# import dependencies
# import pandas as pd
# from selenium import webdriver
# from bs4 import BeautifulSoup
# from tika import parser
# import re
# import sys
import urllib.request
import os
import requests
import subprocess

#data lists
raw = []
file = []
hash = []

def get_files(): # get data from url

    # Get manifest_bg.txt
    url1 = "https://raw.githubusercontent.com/esterTion/redive_master_db_diff/master/%2Bmanifest_bg.txt"
    read1 = requests.get(url1).content.decode('utf-8')
    
    # Get manifest_bg2.txt
    url2 = "https://raw.githubusercontent.com/esterTion/redive_master_db_diff/master/%2Bmanifest_bg2.txt"
    read2 = requests.get(url2).content.decode('utf-8')

    # Combine manifest_bg.txt & manifest_bg2.txt in one list
    url = read1+read2
    # print(url)

    # Save output data to bg.txt
    y = open("bg.txt", "a")
    print(url, file=y)
    print("                           === Extract Complete! ===                            ")
    y.close()

# get all values for extracting
def get_all(): # get all values for extracting with regex
  with open("bg.txt", "r") as f:
      for line in f:
          if 'a/bg_still_unit_' in line:
              start = line.index('bg_still_unit_')
              raw.append(line[start:start+47])
              file.append(line[start:start+28])
              hash.append(line[start+29:start+61])

def report(): # reporting
  print("""
                                 === Raw ===                                   
        """)
  print(raw[:10])
  print("""
                                 === Hash ===                                  
        """)
  print(hash[:10])
  print("""
                              === File Names ===                               
  """)
  print(file[:10])

def extract(): #Get Hash and files name (also raw)
  # downloading 3dUnity
  for x,y in zip(file,hash):
    link = "http://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/"+y[0:2]+"/"+y
    path = r'./raw/'+x
    print("Downloading "+x)
    urllib.request.urlretrieve(link, path)
        
    w = r'/cards/'+x[0:21]+'png'
    os.system("deserialize.py ")
    subprocess.call(['python', 'deserialize.py', x, w])
  print("Download Finished!")

# http://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/${hash.substr(0, 2)}/${hash}


get_files()
get_all()
report()
extract()
