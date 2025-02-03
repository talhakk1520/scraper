const showText = document.querySelector("#showText");
const formContainer = document.querySelector("#formContainer");
const updateContainer = document.querySelector("#updateContainer");
const userName = document.querySelector("#userName");
const logoutButton = document.querySelector("#logoutButton");
let is_update = 0;

async function disableButtons() {
    const buttons = document.querySelectorAll("button");
    buttons.forEach(button => {
        button.disabled = true;
    });
}

async function enableButtons() {
    const buttons = document.querySelectorAll("button");
    buttons.forEach(button => {
        button.disabled = false;
    });
}

logoutButton.addEventListener("click", async () => {
    const isLoggedIn = false;
    await window.electron.setDefaultTab(isLoggedIn);
    await window.electron.logout('login.html');
});

// -------  All Action Performing In app.js  ------- //

async function vendors() {
    try {
        const vendors = await window.electron.getVendors();
        const uName = await window.electron.getUserName();
        userName.innerText = `Welcome ${uName}`;

        vendors.forEach(vendor => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'col-md-3 button-wrapper';

            const button = document.createElement('button');
            button.className = 'btn btn-primary';
            button.innerText = `Scraping of ${vendor.vendor_name}`;

            button.addEventListener("click", async () => {
                is_update = 0;
                const originalText = button.innerHTML;
                button.innerHTML = "Please Wait...";
                disableButtons();

                showText.innerText = `Scraping In Process For ${vendor.vendor_name}`;
                try {
                    const { postLoginPage, cookies, countProduct, runtimeInMinutes } = await window.electron.loginAndPost(vendor.id, is_update);
                    await window.electron.setCookiesAndOpen({ cookies, postLoginPage });

                    await window.electron.addTab(vendor.vendor_name, postLoginPage);

                    showText.innerText = `Successfully Scrapped Of ${vendor.vendor_name} , ${countProduct} Products Added To The Database,Total Time Taken ${runtimeInMinutes} Minutes.`;
                } catch (error) {
                    console.log(error);
                    if (error.message.includes('service')) {
                        const serviceError = error.message.split('service: ')[1];
                        showText.innerText = `Scraping of ${vendor.vendor_name} failed. Service unavailable. ${serviceError}`;
                    } else if (error.message.includes('database')) {
                        showText.innerText = `Unable to retrieve vendor details for ${vendor.vendor_name}. Check database connectivity.`;
                    } else if (error.message.includes('internet')) {
                        showText.innerText = `Internet connection is unavailable. Please check your network and try again.`;
                    } else if (error.message.includes('captcha')) {
                        showText.innerText = `Login to ${vendor.vendor_name} failed. CAPTCHA or unexpected element issue.`;
                    } else {
                        showText.innerText = `Internet connection is unavailable. Please check your network and try again.`;
                    }
                } finally {
                    button.innerHTML = originalText;
                    enableButtons();
                }
            });

            buttonWrapper.appendChild(button);
            formContainer.appendChild(buttonWrapper);
        });
    } catch (error) {
        console.log(error);
        if (error.message.includes('connection')) {
            showText.innerText = `Database connection is unavailable`;
        } else if (error.message.includes('database')) {
            showText.innerText = `Vendors data not found`;
        }
    }
}

async function updateVendors() {
    try {
        const vendors = await window.electron.getUpdateVendors();
        vendors.forEach(vendor => {
            const buttonWrapper = document.createElement('div');
            buttonWrapper.className = 'col-md-3 button-wrapper';

            const button = document.createElement('button');
            button.className = 'btn btn-primary';
            button.innerText = `${vendor.vendor_name}`;

            button.addEventListener("click", async () => {
                is_update = 1;
                const originalText = button.innerHTML;
                button.innerHTML = "Please Wait...";
                disableButtons();

                showText.innerText = `Update Inventory In Process For ${vendor.vendor_name}`;
                try {
                    const { postLoginPage, cookies, countProduct, runtimeInMinutes } = await window.electron.loginAndPost(vendor.id, is_update);
                    await window.electron.setCookiesAndOpen({ cookies, postLoginPage });

                    await window.electron.addTab(vendor.vendor_name, postLoginPage);

                    showText.innerText = `Successfully Updated Inventory Of ${vendor.vendor_name} , ${countProduct} Products Updated In The Database,Total Time Taken ${runtimeInMinutes} Minutes.`;
                } catch (error) {
                    console.log(error);
                    if (error.message.includes('service')) {
                        const serviceError = error.message.split('service: ')[1];
                        showText.innerText = `Scraping of ${vendor.vendor_name} failed. Service unavailable. ${serviceError}`;
                    } else if (error.message.includes('database')) {
                        showText.innerText = `Unable to retrieve vendor details for ${vendor.vendor_name}. Check database connectivity.`;
                    } else if (error.message.includes('internet')) {
                        showText.innerText = `Internet connection is unavailable. Please check your network and try again.`;
                    } else if (error.message.includes('captcha')) {
                        showText.innerText = `Login to ${vendor.vendor_name} failed. CAPTCHA or unexpected element issue.`;
                    } else {
                        showText.innerText = `Internet connection is unavailable. Please check your network and try again.`;
                    }
                } finally {
                    button.innerHTML = originalText;
                    enableButtons();
                }
            });

            buttonWrapper.appendChild(button);
            updateContainer.appendChild(buttonWrapper);
        });
    } catch (error) {
        console.log(error);
        if (error.message.includes('connection')) {
            showText.innerText = `Database connection is unavailable`;
        } 
        // else if (error.message.includes('database')) {
        //     showText.innerText = `Update Inventory Vendors data not found`;
        // }
    }
}


vendors();
updateVendors();
