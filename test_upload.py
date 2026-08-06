import requests

url = "http://localhost:8000/identifiers/upload"
headers = {"Authorization": "Bearer TEST"} # we might need a real token, let's see if it returns 401
files = {"file": ("test.png", b"fake_image_data", "image/png")}
try:
    response = requests.post(url, files=files, headers=headers)
    print(response.status_code)
    print(response.text)
except Exception as e:
    print(e)
