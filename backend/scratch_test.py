import httpx

client = httpx.Client(timeout=10, follow_redirects=True, headers={'User-Agent': 'Mozilla/5.0'})

def test_twitter(username):
    url = f'https://syndication.twitter.com/srv/timeline-profile/screen-name/{username}'
    r = client.get(url)
    print(f'Twitter {username}: {r.status_code}')
    if r.status_code == 200:
        text = r.text.lower()
        if 'timeline cannot be generated' in text or 'user does not exist' in text:
            print('  -> NOT FOUND')
        elif f'"screen_name":"{username.lower()}' in text:
            print('  -> FOUND!')
        else:
            print('  -> UNKNOWN')

test_twitter('elonmusk')
test_twitter('fakeuser000xyz999abc')

def test_keybase(username):
    url = f"https://keybase.io/_/api/1.0/user/lookup.json?usernames={username}"
    r = client.get(url)
    print(f"Keybase {username}: {r.status_code}")
    if r.status_code == 200:
        d = r.json()
        them = d.get('them', [])
        if them and them[0] is not None:
            print('  -> FOUND')
        else:
            print('  -> NOT FOUND')

test_keybase('max')
test_keybase('fakeuser000xyz999abc')
