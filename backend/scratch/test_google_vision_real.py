import os
import sys
import asyncio

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Explicitly load .env variables
from dotenv import load_dotenv
load_dotenv()

from google.cloud import vision

async def main():
    print("GOOGLE_APPLICATION_CREDENTIALS:", os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"))
    print("File exists:", os.path.exists(os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "")))
    
    url = "https://upload.wikimedia.org/wikipedia/commons/8/8c/Cristiano_Ronaldo_2018.jpg"
    print(f"\nSending URL to Google Vision API: {url}...")
    
    try:
        client = vision.ImageAnnotatorClient()
        image = vision.Image()
        image.source.image_uri = url
        
        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.web_detection(image=image)
        )
        
        print("\nAPI Response received!")
        web_detection = response.web_detection
        if not web_detection:
            print("No web detection results found.")
            return

        print("\n--- Web Entities ---")
        for entity in web_detection.web_entities:
            print(f"Entity: {entity.description} (Score: {entity.score})")

        print("\n--- Full Matching Images ---")
        for match in web_detection.full_matching_images:
            print(f"URL: {match.url}")

        print("\n--- Pages With Matching Images ---")
        for page in web_detection.pages_with_matching_images:
            print(f"Page Title: {page.page_title}")
            print(f"URL: {page.url}")

    except Exception as e:
        print("\nError occurred during Google Vision API call:")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
