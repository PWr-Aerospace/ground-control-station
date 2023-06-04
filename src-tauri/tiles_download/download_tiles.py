import os
import requests
from urllib.parse import urlparse

tile_paths = [
    "13/2262/3182.png",
    "13/2263/3182.png",
    "13/2262/3181.png",
    "13/2263/3181.png",
    "13/2262/3183.png",
    "13/2263/3183.png",
    "13/2261/3182.png",
    "13/2261/3181.png",
    "13/2261/3183.png",
    "13/2260/3182.png",
    "13/2260/3181.png",
    "13/2260/3183.png",
    "13/2261/3184.png",
    "13/2262/3184.png",
    "13/2260/3184.png",
    "13/2263/3184.png",
    "13/2264/3181.png",
    "13/2264/3182.png",
    "13/2264/3183.png",
    "13/2264/3184.png",
    "13/2263/3185.png",
    "13/2262/3185.png",
    "13/2264/3185.png",
    "13/2261/3185.png",
    "13/2260/3185.png",
    "13/2265/3183.png",
    "13/2265/3182.png",
    "13/2265/3184.png",
    "13/2265/3185.png",
]


tile_links = [
    "https://c.tile.openstreetmap.org/13/2262/3182.png",
    "https://a.tile.openstreetmap.org/13/2263/3182.png",
    "https://b.tile.openstreetmap.org/13/2262/3181.png",
    "https://c.tile.openstreetmap.org/13/2263/3181.png",
    "https://a.tile.openstreetmap.org/13/2262/3183.png",
    "https://b.tile.openstreetmap.org/13/2263/3183.png",
    "https://b.tile.openstreetmap.org/13/2261/3182.png",
    "https://a.tile.openstreetmap.org/13/2261/3181.png",
    

    "https://a.tile.openstreetmap.org/13/2260/3182.png",
    "https://c.tile.openstreetmap.org/13/2260/3181.png",
    "https://b.tile.openstreetmap.org/13/2260/3183.png",
    "https://a.tile.openstreetmap.org/13/2260/3185.png",
    "https://c.tile.openstreetmap.org/13/2260/3184.png",
    



    "https://c.tile.openstreetmap.org/13/2261/3183.png",
    "https://b.tile.openstreetmap.org/13/2261/3185.png",
    "https://a.tile.openstreetmap.org/13/2261/3184.png",

    "https://c.tile.openstreetmap.org/13/2262/3185.png",
    "https://b.tile.openstreetmap.org/13/2262/3184.png",

    "https://a.tile.openstreetmap.org/13/2263/3185.png",
    "https://c.tile.openstreetmap.org/13/2263/3184.png",
    
    "https://a.tile.openstreetmap.org/13/2264/3181.png",
    "https://b.tile.openstreetmap.org/13/2264/3182.png",
    "https://c.tile.openstreetmap.org/13/2264/3183.png",
    "https://a.tile.openstreetmap.org/13/2264/3184.png",
    "https://b.tile.openstreetmap.org/13/2264/3185.png",

    "https://a.tile.openstreetmap.org/13/2265/3183.png",
    "https://c.tile.openstreetmap.org/13/2265/3182.png",
    "https://b.tile.openstreetmap.org/13/2265/3184.png",
    "https://c.tile.openstreetmap.org/13/2265/3185.png",
]


headers = {
    "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:15.0) Gecko/20100101 Firefox/15.0.1",
    "Referer": "https://www.openstreetmap.org/"
}

for tile_path, tile_link in zip(tile_paths, tile_links):
    # Parse the url and get the name of the image file
    a = urlparse(tile_link)
    filename = os.path.basename(a.path)

    # Create the directories if they don't exist
    os.makedirs(os.path.dirname(tile_path), exist_ok=True)

    # Send a HTTP request to the URL of the image
    response = requests.get(tile_link, headers=headers, stream=True)

    # Check if the request succeeded
    if response.status_code == 200:
        # Open the file in write mode
        with open(os.path.join(tile_path), 'wb') as fp:
            # Write the content of the image to the file
            fp.write(response.content)
    else:
        print(f"Failed to download {tile_link}")