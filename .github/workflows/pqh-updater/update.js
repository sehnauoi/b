/**
 * pqh3.0-updater v2
 * for use with priconne-quest-helper 3.0
 */

 const http = require('http');
 const https = require('https');
 const fs = require('fs');
 const path = require('path');
 const sqlite3 = require('sqlite3').verbose();
 const { open } = require('sqlite');
 const { PythonShell } = require('python-shell');
 const core = require('@actions/core');
 
 const DIRECTORY = Object.freeze({
     SETUP: `${__dirname}/setup`,
     DATA_OUTPUT: `${__dirname}/../../../public`,
     IMAGE_OUTPUT: `${__dirname}/../../../public/images`,
     DATABASE: `${__dirname}/database`,
 });
 const DICTIONARY = Object.freeze({
     EQUIPMENT: {
         FULL: "10",
         FRAGMENT: "11",
         BLUEPRINT: "12",
     },
     QUEST: {
         NORMAL: "11",
         HARD: "12",
         VERY_HARD: "13",
     }
 });
 
 run();
 async function run() {
     core.setOutput("success", false);
     check_directory(DIRECTORY.DATABASE, true);
 
     // get latest version
     const latest = await get_latest_version();
 
     // check updates
     const has_updates = await check_for_updates(latest);
     if (!has_updates) {
         return;
     }
 
     // download all dbs
     const downloaded = await download(latest);
     if (!downloaded) {
         core.error("missing database files, for some reason");
         return;
     }
 
     // setup
     check_directory(DIRECTORY.SETUP, true);
     let data = {
         character: {},
         equipment: {},
         quest: {},
     };

     const unit_data = await get_unit_data();
     data.unit = unit_data;

     const boss_data = await get_boss_data();
     data.boss = boss_data;

     const skill_data = await get_skill_data();
     data.skill = skill_data;

     await get_new_images(data);
 
     console.log("UPDATE COMPLETE!");
     write_file(path.join(DIRECTORY.DATA_OUTPUT, 'version'), latest);
     core.setOutput("success", true);
 }
 
 function get_latest_version() {
     return new Promise(async (resolve) => {
         let latest = "";
         https.get('https://raw.githubusercontent.com/Expugn/priconne-database/master/version.json', (res) => {
             res.on('data', (chunk) => {
                 latest += Buffer.from(chunk).toString();
             });
             res.on('end', () => {
                 resolve(JSON.parse(latest));
             });
         });
     });
 }
 
 function check_for_updates(latest) {
     return new Promise(async (resolve) => {
         const version_file = path.join(DIRECTORY.DATA_OUTPUT, "version");
         if (fs.existsSync(version_file)) {
             const current = fs.readFileSync(version_file, 'utf8');
             console.log('[check_for_updates] EXISTING VERSION FILE FOUND!', current);
             if (current !== JSON.stringify(latest)) {
                 console.log('[check_for_updates] UPDATES AVAILABLE!');
                 resolve(true);
             } else {
                 console.log('[check_for_updates] NO UPDATES AVAILABLE!');
                 resolve(false);
             }
             return;
         }
         resolve(true);
     });
 }
 
 function download(latest) {
     return new Promise(async (resolve) => {
         await Promise.all([
            //  dl("cn"),
            //  dl("en"),
             dl("jp"),
            //  dl("kr"),
            //  dl("tw"),
             dl_manifest(),
         ]);
         resolve(
             fs.existsSync(path.join(DIRECTORY.DATABASE, `master_jp.db`)) &&
             fs.existsSync(path.join(DIRECTORY.DATABASE, `manifest`))
         );
     });
 
     function dl(region = "jp") {
         return new Promise(async (resolve) => {
             const file = fs.createWriteStream(path.join(DIRECTORY.DATABASE, `master_${region}.db`));
             const url = `https://raw.githubusercontent.com/Expugn/priconne-database/master/master_${region}.db`;
 
             https.get(url, (res) => {
                 const stream = res.pipe(file);
                 stream.on('finish', () => {
 
                     console.log(`downloaded master_${region}.db from ${url}`);
                     resolve();
                 });
             });
         });
     }
 
     function dl_manifest() {
         return new Promise(async (resolve) => {
             const manifest_path = await get_path(latest);
             let bundle = "";
             http.request({
                 host: 'prd-priconne-redive.akamaized.net',
                 path: `/dl/Resources/${latest.JP.version}/Jpn/AssetBundles/Windows/${manifest_path[0]}`,
                 method: 'GET',
             }, (res) => {
                 res.on('data', function(chunk) {
                     bundle += Buffer.from(chunk).toString();
                 });
                 res.on('end', () => {
                     bundle += '\n';
                     http.request({
                         host: 'prd-priconne-redive.akamaized.net',
                         path: `/dl/Resources/${latest.JP.version}/Jpn/AssetBundles/Windows/${manifest_path[1]}`,
                         method: 'GET',
                     }, (res) => {
                         res.on('data', function(chunk) {
                             bundle += Buffer.from(chunk).toString();
                         });
                         res.on('end', () => {
                             const file_path = path.join(DIRECTORY.DATABASE, 'manifest');
                             fs.writeFile(file_path, bundle, function (err) {
                                 if (err) throw err;
                                 console.log('DOWNLOADED ICON/UNIT MANIFEST ; SAVED AS', file_path);
                                 resolve();
                             });
                         });
                     }).end();
                 });
             }).end();
         });
 
         function get_path(latest) {
             return new Promise(async (resolve) => {
                 let manifest_assetmanifest = "";
                 http.get(`http://prd-priconne-redive.akamaized.net/dl/Resources/${latest.JP.version}/Jpn/AssetBundles/iOS/manifest/manifest_assetmanifest`, (res) => {
                     res.on('data', (chunk) => {
                         manifest_assetmanifest += Buffer.from(chunk).toString();
                     });
                     res.on('end', () => {
                         let res = [];
                         const b = manifest_assetmanifest.split('\n');
                         let results = b.filter((v) => /icon/.test(v)); // icon assetmanifest
                         res.push(results[0].split(',')[0]);
                         results = b.filter((v) => /unit/.test(v)); // unit assetmanifest
                         res.push(results[0].split(',')[0]);
                         resolve(res);
                     });
                 });
             });
         }
     }
 }

 function get_boss_data() {
    return new Promise(async function(resolve) {
        let result, data = {};
        let db = await open({
            filename: path.join(DIRECTORY.DATABASE, 'master_jp.db'),
            driver: sqlite3.Database
        });
        result = await db.all('SELECT * FROM enemy_parameter WHERE unit_id BETWEEN 300000 AND 309100');
        result.forEach((row) => {
            data[`${row.unit_id}`] = {
                id: `${row.unit_id}`,
            };
        });
            
         // FINISH
         db.close().finally(() => {
             resolve(data);
         });
 })
 } 

 function get_unit_data() {
    return new Promise(async function(resolve) {
        let result, data = {};
        let db = await open({
            filename: path.join(DIRECTORY.DATABASE, 'master_jp.db'),
            driver: sqlite3.Database
        });
        result = await db.all('SELECT * FROM unit_comments');
        result.forEach((row) => {
            data[`${row.unit_id}`] = {
                id: `${row.unit_id}`,
            };
        });
            
         // FINISH
         db.close().finally(() => {
             resolve(data);
         });
 })
 } 
 
 function get_skill_data() {
    return new Promise(async function(resolve) {
        let result, data = {};
        let db = await open({
            filename: path.join(DIRECTORY.DATABASE, 'master_jp.db'),
            driver: sqlite3.Database
        });
        result = await db.all('SELECT * FROM skill_data');
        result.forEach((row) => {
            data[`${row.icon_type}`] = {
                id: `${row.icon_type}`,
            };
        });
            
         // FINISH
         db.close().finally(() => {
             resolve(data);
         });
 })
 }

 function get_new_images(data) {
     return new Promise(async (resolve) => {
         let queue = [];
 
         // CHECK EQUIPMENT
         console.log("SEARCHING FOR MISSING ITEM IMAGES...");
         for (const key in data.equipment) {
             const equipment = data.equipment[key],
                 id = equipment.id,
                 fragment_id = equipment.fragment.id;
             // CHECK IF IMAGE ALREADY EXISTS
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'items', `${id}.png`))) {
                 if (id.substring(0, 2) === "31" || id.substring(0, 2) === "32") {
                     // EQUIPMENT IS A MEMORY PIECE
                     queue.push(`item_${id}`);
                 }
                 else {
                     // REGULAR ITEM, BUSINESS AS USUAL
                     queue.push(`equipment_${id}`);
                 }
             }
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'items', `${fragment_id}.png`)) && fragment_id !== "999999") {
                 queue.push(`equipment_${fragment_id}`);
             }
         }
         queue.push(`equipment_999999`);
 
         // CHECK CHARACTERS ICON 3 & 6 star
         console.log("SEARCHING FOR MISSING 3 & 6 STAR CHARACTERS ICON...");
         for (const key in data.unit) {
                        
             // CHECK IF IMAGE ALREADY EXISTS
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'unit_icon', `${key}.png`)) && key !== `${key.substring(0, 4)}0${key.substring(5)}`) {
                queue.push(`unit_${key}`);
            }
         }

         // CHECK CHARACTERS ICON 1 star
         console.log("SEARCHING FOR MISSING 1 STAR CHARACTERS ICON...");
         for (const key in data.character) {
            // GET THE 1/3/6 star RARITY IMAGE
            const unit_1 = `${key.substring(0, 4)}1${key.substring(5)}`;
                        
             // CHECK IF IMAGE ALREADY EXISTS
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'unit_icon', `${key.substring(0, 4)}1${key.substring(5)}.png`))) {
                queue.push(`unit_${unit_1}`);
            }
         }

         // CHECK SKILLS ICON
         console.log("SEARCHING FOR MISSING SKILLS ICON...");
         for (const key in data.skill) {
                        
             // CHECK IF IMAGE ALREADY EXISTS
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'skill', `${key}.png`))) {
                queue.push(`skill_${key}`);
            }
         }

         // CHECK BOSS ICON
         console.log("SEARCHING FOR MISSING BOSS ICON...");
         for (const key in data.boss) {
            const a_0 = `${key.substring(0, 5)}1`;
                        
             // CHECK IF IMAGE ALREADY EXISTS
             if (!fs.existsSync(path.join(DIRECTORY.IMAGE_OUTPUT, 'unit_icon', `${key.substring(0, 5)}1.png`))) {
                queue.push(`unit_${a_0}`);
            }
         }  
         // EXTRACT IF THERE ARE NEW FILES
         if (queue.length <= 0) {
             console.log("NO MISSING IMAGES FOUND.");
             resolve();
             return;
         }

         console.log(`FOUND ${queue.length} MISSING IMAGES. DOWNLOADING AND DECRYPTING THEM NOW...`);
         console.log(queue);;

         const files = await extract_images(queue);

         resolve();
 
         function extract_images(queue) {
             return new Promise(async (resolve) => {
                 const encrypted_dir = path.join(DIRECTORY.SETUP, 'encrypted');
                 check_directory(encrypted_dir, true);
 
                 // FIND FILE HASH IN MANIFEST
                 const manifest = fs.readFileSync(path.join(DIRECTORY.DATABASE, 'manifest'), 'utf8');
                 let files = {};
 
                 queue.forEach((file_name) => {
                     const index = manifest.indexOf(file_name),
                         line_end = manifest.indexOf('\n', index),
                         file_data = manifest.substring(index, line_end).split(','),
                         type = file_name.includes('equipment') || file_name.includes('item')
                         ? 'items' // equipment || item
                         : file_name.includes('skill')
                         ? 'skill' // icon_icon_skill
                         : 'unit_icon', // unit
                         decrypted_name = file_name.split('_')[1];
                     files[file_name] = {
                         hash: file_data[1],
                         encrypted: path.join(DIRECTORY.SETUP, 'encrypted', `${file_name}.unity3d`),
                         // CONVERT unit_icon IMAGE NAME BACK TO 0star RARITY SO IT CAN BE ACCESSED MORE EASILY
                         // REASON BEING IS THAT unit_id IS SAVED AS 0star RARITY ID
                         decrypted: path.join(DIRECTORY.IMAGE_OUTPUT, type, `${type !== 'unit_icon'
                             ? decrypted_name : `${decrypted_name}`}.png`),
                     };
                 });
 
                 // DOWNLOAD ENCRYPTED .unity3d FILES FROM CDN
                 for (const file_name in files) {
                     await get_asset(files[file_name].encrypted, files[file_name].hash);
                     console.log(`DOWNLOADED ${file_name}.unity3d [${files[file_name].hash}] ; SAVED AS ${files[file_name].encrypted}`);
                     deserialize(files[file_name].encrypted, files[file_name].decrypted);
                 }
                 resolve(files);
             });
 
             function get_asset(output_path, hash) {
                 return new Promise(async function(resolve) {
                     const file = fs.createWriteStream(output_path);
                     http.get(`http://prd-priconne-redive.akamaized.net/dl/pool/AssetBundles/${hash.substr(0, 2)}/${hash}`, function(response) {
                         const stream = response.pipe(file);
                         stream.on('finish', () => {
                             resolve();
                         });
                     });
                 });
             }
 
             function deserialize(import_path, export_path, silent = false) {
                 return new Promise(async function(resolve) {
                     PythonShell.run(`${__dirname}/deserialize.py`,
                         { args: [import_path, export_path] },
                         function (err, results) {
                             if (err) throw err;
                             if (!silent) {
                                 for (let i of results) {
                                     console.log('[deserialize.py]', i);
                                 }
                             }
                             resolve();
                         }
                     );
                 });
             }
         }

     });
 }
 
 function check_directory(directory, do_clean = false) {
     if (!directory) {
         return;
     }
 
     if (!fs.existsSync(directory)) {
         fs.mkdirSync(directory);
     }
 
     if (do_clean) {
         clean(directory);
     }
 
     function clean(dir) {
         const files = fs.readdirSync(dir);
         for (const file of files) {
             if (fs.statSync(path.join(dir, file)).isDirectory()) {
                 clean(path.join(dir, file));
                 fs.rmdirSync(path.join(dir, file));
             }
             else {
                 fs.unlinkSync(path.join(dir, file));
             }
         }
     }
 }
 
 function write_file(path, data, readable = false) {
     fs.writeFile(path, JSON.stringify(data, null, readable ? 4 : 0), async function (err) {
         if (err) throw err;
     });
 }
