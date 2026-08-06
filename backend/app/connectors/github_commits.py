import logging
import httpx
from app.connectors.base import BaseConnector, Finding
from app.models import IdentifierType

logger = logging.getLogger(__name__)


class GithubCommitEmailConnector(BaseConnector):
    """
    Extracts real email addresses from a GitHub user's public commit history.

    Most people don't realize that every Git commit they push to GitHub
    contains their configured git email address — even if their profile
    email is set to private. This is one of the highest-value OSINT pivots
    available: username → confirmed real email → breach check → full identity.

    Strategy:
      1. GET /users/{username}/repos?sort=pushed&per_page=3  (most recently active repos)
      2. For each repo, GET /repos/{owner}/{repo}/commits?per_page=5
      3. Extract commit.author.email, filter out noreply addresses
      4. Emit unique real emails as findings

    Rate limit: 60 req/hour unauthenticated (shared by IP).
    """
    name = "github_commit_email"
    applies_to = (IdentifierType.username,)
    timeout_seconds = 10.0
    max_retries = 0

    # Emails to filter out — these are GitHub's noreply addresses and common defaults
    IGNORE_EMAILS = {
        "noreply@github.com",
        "action@github.com",
        "actions@github.com",
    }

    # Patterns that indicate a GitHub noreply address
    NOREPLY_PATTERNS = (
        "@users.noreply.github.com",
        "noreply@",
        "[bot]@",
        "+",  # GitHub noreply format: 12345+user@users.noreply.github.com
    )

    async def check_health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(
                    "https://api.github.com/rate_limit",
                    headers={"User-Agent": "e-Rakshak-OSINT/1.0"}
                )
                return res.status_code == 200
        except Exception as e:

            logger.error(f"Unexpected error: {e}", exc_info=True)
            return False

    async def run(self, identifier_value: str, metadata: dict | None = None) -> list[Finding]:
        username = identifier_value.strip().lstrip("@")
        if not username or len(username) < 2:
            return []

        findings: list[Finding] = []
        seen_emails: set[str] = set()
        seen_names: set[str] = set()

        headers = {
            "User-Agent": "e-Rakshak-OSINT/1.0",
            "Accept": "application/vnd.github+json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds, follow_redirects=True) as client:
                # Step 1: Get user's most recently pushed repos
                repos_url = f"https://api.github.com/users/{username}/repos?sort=pushed&per_page=3"
                repos_response = await client.get(repos_url, headers=headers)

                if repos_response.status_code == 404:
                    return []  # User doesn't exist on GitHub
                if repos_response.status_code != 200:
                    return []  # Rate limited or other error

                repos = repos_response.json()
                if not isinstance(repos, list) or not repos:
                    return []

                # Step 2: For each repo, check recent commits
                for repo_data in repos[:3]:
                    repo_name = repo_data.get("name")
                    owner = repo_data.get("owner", {}).get("login")
                    if not repo_name or not owner:
                        continue

                    commits_url = f"https://api.github.com/repos/{owner}/{repo_name}/commits?per_page=5"
                    commits_response = await client.get(commits_url, headers=headers)

                    if commits_response.status_code != 200:
                        continue

                    commits = commits_response.json()
                    if not isinstance(commits, list):
                        continue

                    for commit_data in commits:
                        commit = commit_data.get("commit", {})
                        author = commit.get("author", {})
                        email = (author.get("email") or "").strip().lower()
                        name = (author.get("name") or "").strip()

                        if not email:
                            continue

                        # Skip GitHub noreply addresses and bot emails
                        if email in self.IGNORE_EMAILS:
                            continue
                        if any(pattern in email for pattern in self.NOREPLY_PATTERNS):
                            continue

                        # Skip if already seen
                        if email in seen_emails:
                            continue
                        seen_emails.add(email)

                        # Determine if this is likely a personal or corporate email
                        email_domain = email.split("@")[1] if "@" in email else ""
                        is_personal = email_domain in (
                            "gmail.com", "yahoo.com", "hotmail.com", "outlook.com",
                            "protonmail.com", "icloud.com", "live.com", "aol.com",
                            "mail.com", "yandex.com", "tutanota.com",
                        )
                        email_category = "personal" if is_personal else "corporate/custom"

                        findings.append(Finding(
                            connector_name=self.name,
                            result_type="commit_email",
                            result_value=f"Git Commit Email: {email}",
                            confidence=0.95,
                            raw_payload={
                                "email": email,
                                "author_name": name,
                                "github_username": username,
                                "email_category": email_category,
                                "email_domain": email_domain,
                                "source": "github_repo_commits",
                            }
                        ))

                        # Also emit the author name if it looks like a real name (has space)
                        if name and " " in name and name not in seen_names:
                            seen_names.add(name)
                            findings.append(Finding(
                                connector_name=self.name,
                                result_type="commit_author_name",
                                result_value=f"Git Author: {name}",
                                confidence=0.85,
                                raw_payload={
                                    "name": name,
                                    "associated_email": email,
                                    "github_username": username,
                                }
                            ))

                    # Stop after finding at least one real email
                    if seen_emails:
                        break

        except Exception as e:


            logger.warning(f"Silenced exception: {e}", exc_info=True)

        return findings
