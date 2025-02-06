const { app, BrowserWindow, session, ipcMain, Notification } = require('electron');
const  { getConnection, getPoolConnection } = require('./database');
const { Builder, By} = require('selenium-webdriver');
const firefox = require('selenium-webdriver/firefox');
const { encrypt, hash} = require('keyhasher');
const Store = require('electron-store');
const store = new Store();
const path = require('path');
const cheerio = require('cheerio');
require('electron-reload')(__dirname);

// -------  Creating Main Window  ------- //

async function createWindow() {
    try {
        const removeCookies = await session.defaultSession.cookies.get({});
        for (let cookie of removeCookies) {
            const url = `${cookie.secure ? 'https' : 'http'}://${cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain}${cookie.path}`;
            await session.defaultSession.cookies.remove(url, cookie.name);
        }
    } catch (error) {
        console.log('Error removing cookies:', error);
    }
    const win = new BrowserWindow({
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            webviewTag: true,
            contextIsolation: false
        }
    });
    win.loadFile(path.join(__dirname, 'index.html'));
    global.isLoggedIn = store.get('isLoggedIn') ?? false;
    global.userName = store.get('Name') ?? null;
    global.user_name = store.get('Username') ?? null;
    win.webContents.on('did-finish-load', () => {
        const isLoggedIn = global.isLoggedIn ?? false;
        win.webContents.send('set-default-tab', isLoggedIn);
    });
    win.maximize();
    win.show();
    // win.webContents.openDevTools();  // for debugging
}

// -------  Performing Login  ------- //

ipcMain.handle('perform-login', async (event, { username, password }) => {
    try {
        const passCode = '572';
        const passEncrypt = encrypt(password, passCode);
        const hashedPass = hash(passEncrypt);
        const connection = await getConnection();
        const result = await connection.query(`CALL GetVendorUserLogin(? COLLATE utf8_unicode_ci, ? COLLATE utf8_unicode_ci)`,[username, hashedPass]);
        
        if(result.length > 0){
            global.userName = result[0][0].name;
            global.user_name = result[0][0].username;
            store.set('Name', global.userName);
            store.set('Username', global.user_name);
            store.set('isLoggedIn', true);
            new Notification({
                title: `${global.userName}`,
                body: `Login successfully`,
            }).show();
            return { success: true, message: 'Login successful.' };
        }else{
            return { success: false, message: 'Invalid username or password.' };
        }
    } catch (error) {
        if (error.message.includes('Cannot read properties of undefined')) {
            return { success: false, message: 'Invalid username or password.' };
        } else {
            return { success: false, message: `Database error: ${error.message}` };
        }
    }
});

ipcMain.handle('get-user-name', async () => {
    return global.userName || null;
});

// -------  Getting All Vendors  ------- //

ipcMain.handle('getVendors', async () => {
    try {
        const connection = await getConnection();
        const [vendors] = await connection.query(`CALL GetVendorsByUsername(?)`,[global.user_name]);
        
        return vendors;
    } catch (error) {
        console.log(error);
        if (error.message.includes('database')) {
            throw error;
        }
        if (error.message.includes('connection')) {
            throw error;
        }
    }
})

ipcMain.handle('getUpdateVendors', async () => {
    try {
        const connection = await getConnection();
        const [vendors] = await connection.query(`CALL GetVendorsIsUpdateByUsername(?)`,[global.user_name]);
        if (vendors == null || vendors.length === 0) {
            throw new Error('database: Vendor data not found.');
        }
        return vendors;
    } catch (error) {
        console.log(error);
        if (error.message.includes('database')) {
            throw error;
        }
        if (error.message.includes('connection')) {
            throw error;
        }
    }
})

let countProduct = 0;

let runtimeInMinutes;
let startTime;
let endTime;
let totalRuntime;

let updated_by;

// -------  Performing Login and After Login Process  ------- //

ipcMain.handle('loginAndPost', async (event, vendorId, is_update) => {
    let driver;
    updated_by = global.userName;
    startTime = Date.now();
    try {
        const conn = await getConnection();
        const [vendorDetails] = await conn.query(`CALL GetVendorById(?)`, [vendorId]);

        if (!vendorDetails || vendorDetails.length === 0) {
            throw new Error('database: Vendor data not found.');
        }

        const { vendor_name, link, email, password, is_type_vpn, is_label, not_type_submit} = vendorDetails[0];   

        const options = new firefox.Options();
        // options.addArguments('--headless');

        driver = await new Builder()
            .forBrowser('firefox')
            .setFirefoxOptions(options)
            .build();

        try {
            await driver.get(link);
        } catch (error) {
            if (error.message.includes('ERR_INTERNET_DISCONNECTED')) {
                throw new Error('internet: Internet connection is unavailable.');
            }
            if (error.message.includes('ECONNREFUSED')) {
                throw new Error('internet: Internet connection is unavailable.');
            }
            throw error;
        }

        try {
            await driver.sleep(4000);
            if(is_label == 1){

                await driver.findElement(By.xpath("//input[(@type='email' or @type='text') and following::input[@type='password']]")).sendKeys(email);
                await driver.findElement(By.xpath("//input[@type='password']")).sendKeys(password);
                await driver.findElement(By.css('.custom-control-label')).click();
                await driver.findElement(By.xpath("//button[@type='submit']")).click();

            } else if (not_type_submit == 1) {

                await driver.findElement(By.id("username")).sendKeys(email);
                await driver.findElement(By.xpath("//input[@type='password']")).sendKeys(password);
                await driver.findElement(By.id('loginBtn')).click();
                await driver.sleep(3000);

            } else if (is_type_vpn == 1){
                await driver.findElement(By.xpath("//input[@type='email']")).sendKeys(email);
                await driver.findElement(By.xpath("//input[@type='password']")).sendKeys(password);
                await driver.findElement(By.css(".btn.btn-default.pull-right")).click();
                await driver.sleep(3000);
            } else {

                await driver.findElement(By.id("username")).sendKeys(email);
                await driver.findElement(By.xpath("//input[@type='password']")).sendKeys(password);
                await driver.findElement(By.xpath("//*[@type='submit']")).click();
                await driver.sleep(3000);

            }
        } catch (e) {
            console.log(e);
            throw new Error('captcha: Login failed due to CAPTCHA or missing form element.');
        }

        const postLoginPage = await driver.getCurrentUrl();
        const cookies = await driver.manage().getCookies();

        if(is_label == 1){

            await driver.sleep(2000);
            await driver.get('https://b2b.anita.com/en/shop/410/?sicht=S');
            await driver.sleep(3000);

            try {
                await processAnita(driver, vendor_name, is_update);
            } catch (error) {
                if (error.message.includes('service')) {
                    throw error;
                }
            }

        } else if(not_type_submit == 1) {
            await driver.sleep(2000);
            try {
                await processwp(driver, conn, vendor_name, is_update);
            } catch (error) {
                throw error;
            }

        } else if (is_type_vpn == 1) {

            await driver.sleep(2000);
            try {
                await processProClub(driver, is_update);
            } catch (error) {
                throw error;    
            }

        } else {

            await driver.sleep(10000);

            try {
                await processLoom(driver, conn, vendor_name, is_update);
                console.log("All chunks processed successfully.");
            } catch (error) {
                if (error.message.includes('service')) {
                    throw error;
                }
            }

        }

        endTime = Date.now();
        totalRuntime = endTime - startTime;
        runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
        
        return { postLoginPage, cookies, countProduct, runtimeInMinutes };
    } catch (error) {
        if (error.message.includes('ECONNREFUSED')) {
            throw new Error('internet: Internet connection is unavailable.');
        }
        if (error.message.includes('ERR_INTERNET_DISCONNECTED')) {
            throw new Error('internet: Internet connection is unavailable.');
        }
        if (error.message.includes('database')) {
            throw error;
        }
        if (error.message.includes('captcha')) {
            throw error;
        }
        if (error.message.includes('service')) {
            throw error;
        }
        console.log(error);
        throw new Error('Unexpected error occurred during login.');
    } finally {
        if (driver) {
            await driver.quit();
            if(is_update == 1){
                console.log(`Total Products Updated In The Database: ${countProduct}`);
            }else{
                console.log(`Total Products Added To The Database: ${countProduct}`);
            }
            countProduct = 0;
        }
    }
});

// ANITA

async function processAnita(driver, vendor_name, is_update) {
    let mainArray = [];
    try {
        const rows = await driver.findElements(By.css('.table tbody'));
        for (let row of rows) {
            const linkElement = await row.findElement(By.css('td a'));
            const link = await linkElement.getAttribute('href');
            const STYLECODE = (await linkElement.getText()).trim();

            mainArray.push({
                url: `${link}`,
                stylecode: STYLECODE,
            });
        }
        mainArray.shift();

        const productChunks = splitArrayIntoChunks(mainArray, 150);
        
        for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex++) {
            const productChunk = productChunks[chunkIndex];
            console.log(`Processing chunk ${chunkIndex + 1} of ${productChunks.length}...`);
            
            for (let product of productChunk) {
                const collectedData = [];
                try {
                    await driver.get(product.url);
                    await driver.sleep(500);
                    const product_name = await driver.findElement(By.css('h2.text-primary')).getText();
                    // console.log(product_name);

                    const htmlContent = await driver.getPageSource();
                    const $ = cheerio.load(htmlContent); 
                    try {
                        
                        $('.table-responsive').each(async (z, div) => {
                            const sizeElements = $(div).find('.table-striped thead tr th:not(:first-child):not(:last-child)');
                            const colorHeading = $(div).closest('.change-cart-form').find('h4');
                            const COLORNAME = colorHeading.map((_, ch) => $(ch).text().trim()).get();
    
                            $(div).find('.table-striped tr:not(.collapse-mglt)').each(async (_, row) => {
                                const th = $(row).find('th').text().trim();
                                const breaking = COLORNAME[z].split(/(?<=^\S+)\s/);
                                const colorcode = breaking[0];
                                const color = breaking[1];
                                let price = $(row).find('td .ekp').text().trim();
                                price = price.split(' ')[0]
                                let map = $(row).find('td .vkp').text().trim();
                                map = map.split(' ')[0]
                                const cells = $(row).find('td:not(:last-child)');
    
                                cells.each(async (index, cell) => {
                                    const actualSize = $(sizeElements[index]).text().trim();
                                    const checkStockAvailable = $(cell).html();
    
                                    let inventory = '0';
                                    let date = '0';
                                    if( checkStockAvailable == '&nbsp;'){
                                        inventory = '0';
                                    } else {
                                        const divContent2 = $(cell).find('input').data('content');
    
                                        if (divContent2 != undefined) {
                                            if (divContent2 && divContent2.includes('stock')) {
                                                const [inventoryValue, dateValue] = divContent2.replace('stock: ', '').split(' ');
                                                inventory = inventoryValue;
                                                date = dateValue;
                                            }
                                        } else {
                                            inventory = '5';
                                        }
                                    }
    
                                    const cup_size = th ?? '';

                                    if(price === ''){
                                        console.log('price is 0.00');
                                    }else{
                                        collectedData.push({
                                            vendor_name,
                                            product_name,
                                            updated_by,
                                            is_update,
                                            stylecode: product.stylecode,
                                            colorcode,
                                            color,
                                            actualSize,
                                            cup_size,
                                            inventory,
                                            price,
                                            map,
                                            date,
                                        });
                                    }
    
                                });
                            });
                        });

                        
                    } catch (error) {
                        console.log(error);
                    }
                    
                    const query = `CALL sp_BatchInsertOrUpdateAnitaData(?)`;
                    await bulkInsert(collectedData, 2000, query);
                } catch (error) {
                    console.log(error);
                    console.log(`Error in Product Url: ${product.url}`);
                    console.log(`Error while processing chunk ${chunkIndex + 1}: ${error.message}`);
                    endTime = Date.now();
                    totalRuntime = endTime - startTime;
                    runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
                    if (is_update == 1) {
                        throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
                    } else {
                        throw new Error(`service: ${countProduct} products added to the database,total time taken ${runtimeInMinutes} minutes.`);
                    }
                }
            }
            console.log(`Finished processing chunk ${chunkIndex + 1} of ${productChunks.length}.`);
            await driver.sleep(2000);
        }

        
    } catch (error) {
        console.error(error);
        endTime = Date.now();
        totalRuntime = endTime - startTime;
        runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
        if (is_update == 1) {
            throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
        } else {
            throw new Error(`service: ${countProduct} products added to the database,total time taken ${runtimeInMinutes} minutes.`);
        }
    }
}

// BULK INSERT

const bulkInsert = async (data, batchSize = 1000, query) => {
    try {
        const chunks = splitArrayIntoChunks(data, batchSize);
        // const pool = await getPoolConnection();

        for (const [index, chunk] of chunks.entries()) {
            const jsonData = JSON.stringify(chunk);
            try {
                const conn = await getConnection();
                const result = await conn.query(query, [jsonData]);
                // const result = await pool.query(query, [jsonData]);
                countProduct += result.affectedRows;
                console.log(`Batch ${index + 1} inserted/updated successfully`);
            } catch (error) {
                console.error(`Error processing batch ${index + 1}:`, error);
            }
        }

    } catch (error) {
        console.error('Error in bulk insert/update:', error);
    }
};


// Whispering Pines Sportswear

async function processwp(driver, conn, vendor_name, is_update) {
    let productCollect = [];
    try {
        const stylecodes = await conn.query('SELECT DISTINCT(style) FROM vendor_data WHERE vendor_name = ?', [vendor_name]);
        for(let sc of stylecodes){
            const link = `https://www.wpsportswear.com/product/${sc.style}/`;
            productCollect.push({
                url: link,
                stylecode: sc.style,
            });
        }
    
        await driver.get(productCollect[0].url);
        await driver.sleep(2000);
        await driver.findElement(By.id('gridMode')).click();
        await driver.findElement(By.css('#gridMode option[value="whse"]')).click();
    
        const productChunks = splitArrayIntoChunks(productCollect, 50);
    
        for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex++) {
            const productChunk = productChunks[chunkIndex];
            console.log(`Processing chunk ${chunkIndex + 1} of ${productChunks.length}...`);
    
            for(let product of productChunk){
                try {
                    await driver.get(product.url);
                    await driver.sleep(8000);
                    // const product_name = await conn.query('SELECT product_name FROM vendor_data WHERE style = ? AND vendor_name = ? GROUP BY product_name', [product.stylecode, vendor_name]);
                    // await conn.query('DELETE FROM vendor_data WHERE style = ? AND vendor_name = ?', [product.stylecode, vendor_name]);
                    
                    // const product_name = await driver.findElement(By.css('.styleDescDiv span')).getText();
                    const allColorsDiv = await driver.findElements(By.css('.product-item'));
                    for (let colorDiv of allColorsDiv){
                        const colorAndCode = await colorDiv.findElement(By.css('.gridColorDesc')).getText();
                        const [color, colorCode] = colorAndCode.split(' - ').map(part => part.trim());
    
                        const allSizesDiv = await colorDiv.findElements(By.css('.product-elem:not(.product-elem-disabled)'));
                        for (let sizeDiv of allSizesDiv){
                            const checkSize = await sizeDiv.findElement(By.css('.product-size')).getText();
                            let size = '';
                            if(checkSize.includes('OSFM')){
                                size = 'ONE SIZE FITS MOST';
                            } else if(checkSize.includes('OSFA')){
                                size = 'ONE SIZE FITS ALL';
                            } else {
                                size = checkSize;
                            }
    
                            const checkQuantity = await sizeDiv.findElement(By.css('.product-count span')).getText();
                            let quantity = 0;
                            if(checkQuantity.includes('Out of Stock')){
                                quantity = 0;
                            } else if(checkQuantity.includes('500+')){
                                quantity = 500;
                            } else {
                                
                                quantity = checkQuantity;
                            }
    
                            const priceRaw = await sizeDiv.findElement(By.css('.product-price')).getText();
                            const price = parseFloat(priceRaw.replace("$", ""));

                            // await conn.query('INSERT INTO vendor_data(vendor_name, product_name, style, color_code, color, size, quantity, cost) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
                            //     [vendor_name, product_name[0].product_name, product.stylecode, colorCode, color, size, quantity, price]
                            // );
    
                            if(is_update == 1){
                                const result = await conn.query('CALL sp_updateWPData(?, ?, ?, ?, ?, ?, ?)',
                                    [quantity, price, product.stylecode, colorCode, color, size, updated_by]
                                );
                                if(result.affectedRows == 1){
                                    countProduct++;
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(error);
                    console.log(`Error in Product Url: ${product.url}`);
                    console.log(`Error while processing chunk ${chunkIndex + 1}: ${error.message}`);
                }
            }
            console.log(`Finished processing chunk ${chunkIndex + 1} of ${productChunks.length}.`);
            await driver.sleep(2000);
        }
    } catch (error) {
        console.log(error);
        endTime = Date.now();
        totalRuntime = endTime - startTime;
        runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
        throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
    }
}

// PRO CLUB

async function processProClub(driver, is_update) {
    let productCollect = [];
    const categories = [
        'https://www.proclubinc.com/mens/?limit=100',
        'https://www.proclubinc.com/womens/',
        'https://www.proclubinc.com/youth/',
        'https://www.proclubinc.com/accessories/'
    ];

    for (let category of categories) {
        try {
            await driver.get(category);
            await driver.sleep(2000);
            const productElements = await driver.findElements(By.css('.shop-item-summary'));
            for (let product of productElements) {
                const productName = await product.findElement(By.css('a')).getText();
                const productUrl = await product.findElement(By.css('a')).getAttribute('href');
                productCollect.push({
                    productName: productName,
                    productUrl: productUrl,
                });
            }
            
        } catch (error) {
            console.log(error);
            endTime = Date.now();
            totalRuntime = endTime - startTime;
            runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
            throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
        }
    }
    console.log(`Total Products link: ${productCollect.length}`);

    const productChunks = splitArrayIntoChunks(productCollect, 40);

    for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex++) {
        console.log(`Processing chunk ${chunkIndex + 1} of ${productChunks.length}...`);
        const productChunk = productChunks[chunkIndex];

        for(let product of productChunk){
            let collectedData2 = [];
            try {
                await driver.get(product.productUrl);
                await driver.sleep(2000);
                const htmlContent = await driver.getPageSource();
                const $ = cheerio.load(htmlContent);

                const style_code = $('.clearfix #div_product_itemno').text();

                $('table').eq(0).find('tr:not(:eq(0))').each(function () {
                    let colorname = $(this).find('.font-dark ').eq(1).text();
        
                    $(this).find('table').eq(0).find('tr').find('td').each(function () {
                        let currentData = $(this).html();
                        if(currentData.includes('&nbsp;')){
                            return;
                        } else {
                            let price = $(this).find('.txt-default').html();
                            price = parseFloat(price.replace('$', ''));
                            let size = $(this).find('.MainQty').attr('placeholder');
                            let qty = $(this).find('span').html();
                            if (qty.includes('500+')) {
                                qty = 500;
                            } else if (qty == ''){
                                qty = 0;
                            }
            
                            collectedData2.push({
                                product_name: product.productName,
                                style_code: style_code,
                                color: colorname,
                                size: size,
                                quantity: parseInt(qty),
                                price: price,
                                updated_by: updated_by,
                            });
                        }
                    });
                });
                const query = `CALL sp_BatchUpdateProClubData(?)`;
                await bulkInsert(collectedData2, 2000, query);
            } catch (error) {
                console.log(error);
                console.log(`Error in Product Url: ${product.productUrl}`);
                console.log(`Error while processing chunk ${chunkIndex + 1}: ${error.message}`);
                endTime = Date.now();
                totalRuntime = endTime - startTime;
                runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
                throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
            }
        }
        console.log(`Finished processing chunk ${chunkIndex + 1} of ${productChunks.length}.`);
        await driver.sleep(10000);
    }    
}


// FRUIT OF THE LOOM

async function processLoom(driver, conn, vendor_name, is_update) {
    let productCollect = [];

        for(let i = 1; i <= 5; i++) {
            try {
                const productElements = await driver.findElements(By.css(".product-details"));   
                for (let product of productElements) {

                    const productName = await product.findElement(By.css("format-text")).getText();
            
                    const productStyle = await product.findElement(By.css(".product-number")).getText();
            
                    const formattedProductName = productName.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, "-"); 
            
                    const productUrl = `https://b2b.fruit.com/p/${formattedProductName}/${productStyle}`;
    
                    productCollect.push({
                        productName: productName,
                        productStyle: productStyle,
                        productUrl: productUrl,
                    })
                }
    
                if (i !== 5){
                    const nextButton = await driver.findElement(By.xpath("//a[text()='Next']"));
                    await nextButton.click();
                    await driver.sleep(3000);
                }       
            } catch (error) {
                endTime = Date.now();
                totalRuntime = endTime - startTime;
                runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
                if (is_update == 1) {
                    throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
                } else {
                    throw new Error(`service: ${countProduct} products added to the database,total time taken ${runtimeInMinutes} minutes.`);
                }
            }
        }

        console.log(`Total Products link: ${productCollect.length}`);

        const productChunks = splitArrayIntoChunks(productCollect, 40);

        for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex++) {
            const productChunk = productChunks[chunkIndex];
            console.log(`Processing chunk ${chunkIndex + 1} of ${productChunks.length}...`);

            for (let product of productChunk) {
                try {
                    await driver.get(product.productUrl);
                    await driver.sleep(10000);

                    const allColors = await driver.findElements(By.xpath("//div[contains(@class, 'swatch-color-text')]"));
                    if (allColors.length > 0) {
                        for (let i = 0; i < allColors.length; i++) {
                            const parentDiv = await allColors[i].findElement(By.xpath(".."));
                            await parentDiv.click();
                            await driver.sleep(1000);
                
                            const colorElement = await driver.findElement(By.xpath("//div[contains(@class, 'col-xs-2 pdp-grid-col')]/span[contains(@class, 'ng-binding') and following::div[contains(@class, 'col-xs-1 pdp-grid-col')]]"));
                            const color = await colorElement.getText();
                
                            await processRows(driver, color, product, conn, vendor_name, is_update);
                            await driver.sleep(1500);
                        }
                    } else {
                        const colorElement = await driver.findElement(By.xpath("//div[contains(@class, 'col-xs-2 pdp-grid-col')]/span[contains(@class, 'ng-binding') and following::div[contains(@class, 'col-xs-1 pdp-grid-col')]]"));
                        const color = await colorElement.getText();
                
                        await processRows(driver, color, product, conn, vendor_name, is_update);
                        await driver.sleep(1500);
                    }
                } catch (error) {
                    console.log(error);
                    console.log(`Error in Product Url: ${product.productUrl}`);
                    console.log(`Error while processing chunk ${chunkIndex + 1}: ${error.message}`);
                    endTime = Date.now();
                    totalRuntime = endTime - startTime;
                    runtimeInMinutes = (totalRuntime / (1000 * 60)).toFixed(2);
                    if (is_update == 1) {
                        throw new Error(`service: ${countProduct} products updated in the database,total time taken ${runtimeInMinutes} minutes.`);
                    } else {
                        throw new Error(`service: ${countProduct} products added to the database,total time taken ${runtimeInMinutes} minutes.`);
                    }
                }
            }
            console.log(`Finished processing chunk ${chunkIndex + 1} of ${productChunks.length}.`);
            await driver.sleep(60000);
        }
}

// CHUNKS ARRAY

function splitArrayIntoChunks(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}


// PROCESS ROW OF FRUIT OF THE LOOM

async function processRows(driver, color, product, conn, vendor_name, is_update) {
    const rows = await driver.findElements(By.xpath("//div[contains(@class, 'row')][div[contains(@class, 'col-xs-3')]/span[contains(@class, 'pdp-grid-span')]]"));

    for (let row of rows) {
        const htmlContent = await row.getAttribute('outerHTML');
        const $ = cheerio.load(htmlContent);

        const size = $("div.col-xs-2.pdp-grid-col > span.pdp-grid-span").first().text().trim();
        const upc = $("div.col-xs-3.pdp-grid-col > span.pdp-grid-span").text().trim();
        const price = parseFloat(
            $("div.col-xs-2.pdp-grid-col > span.pdp-grid-span").last().text().replace("$", "").trim()
        );
        const quantity = $("div.col-xs-4.pdp-grid-col > span.pdp-grid-qty").first().text().trim();

        try {     
            if(is_update == 1){
                const result = await conn.query('CALL sp_UpdateFOTLData(?, ?, ?, ?)',
                    [quantity, price, upc, updated_by]
                );
                if(result.affectedRows == 1){
                    countProduct++;
                }
    
            } else {
                const result = await conn.query('CALL sp_InsertFOTLData(?, ?, ?, ?, ?, ?, ?, ?)',
                    [vendor_name, product.productName, product.productStyle, color, size, upc, quantity, price]
                );
                if(result.affectedRows == 1){
                    countProduct++;
                }  
            }
        } catch (error) {
            console.log(error);
        }


    }
}

// -------  Saving Cookies  -------- //

ipcMain.handle('setCookiesAndOpen', async (event, { cookies, postLoginPage }) => {
    for (let cookie of cookies) {
        const cookieObj = {
            url: postLoginPage, 
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
            httpOnly: cookie.httpOnly,
            expirationDate: cookie.expiry,
        };
        await session.defaultSession.cookies.set(cookieObj);
    }
});

// -------  Sending Event To Main Window to Open Tab  ------- //

ipcMain.on('request-add-tab', (event, title, url) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('add-tab', title, url);
});

// -------  Sending Event To Main Window to Update Tab  ------- //

ipcMain.on('request-update-tab', (event, url) => {
    global.isLoggedIn = true;
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('update-tab', url);
});

// -------  Sending Event To Main Window to Set Default Tab  ------- //

ipcMain.handle('request-set-default-tab', (event, isLoggedIn) => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('set-default-tab', isLoggedIn);
});

// -------  Sending Event To Main Window to Logout  ------- //

ipcMain.on('request-logout', (event, url) => {
    global.isLoggedIn = false;
    store.delete('isLoggedIn');
    store.delete('Name');
    store.delete('Username');
    new Notification({
        title: `${global.userName}`,
        body: `Logout successfully`,
    }).show();
    global.userName = null;
    global.user_name = null;
    const mainWindow = BrowserWindow.getAllWindows()[0];
    mainWindow.webContents.send('update-tab', url);
});

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
})