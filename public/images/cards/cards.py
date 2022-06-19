import requests
from bs4 import BeautifulSoup
import os
import shutil

 
url = 'https://redive.estertion.win/card/full/'
reqs = requests.get(url)
soup = BeautifulSoup(reqs.text, 'html.parser')
 
urls = []
for link in soup.find_all('a'):
    url = link.get('href')
    r = requests.get('https://redive.estertion.win/card/full/'+url, stream=True)
    if r.status_code == 200:
        with open(url, 'wb') as f:
            r.raw.decode_content = True
            shutil.copyfileobj(r.raw, f)

    base = os.path.splitext(url)[0]
    os.rename(url, base + '.png')

