const fs = require('fs');
const csv = require('csv-parser');

//Open and read the CSV file provided
function readCSV(filePath) {
    return new Promise((resolve, reject) => {
        //Initialise an empty products array
        const products = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            //Add each row to the products array
            .on('data', (row) => {
                products.push(row);
            })
            .on('end', () => {
                resolve(products);
            })
            .on('error', (err) => {
                //This will be caught by error handling
                reject(err);
            });
    });
}

//Sort each product based on the pick location
function sortProductsByLoc(products) {

    /*Sort works on the basis that:
    - Negative means a comes before b
    - Positive mean a comes after b
    - Zero indicates they are equal
    */
    return products.sort((a, b) => {
        //As we sort, get the two we're sorting currently and get their bay and shelf
        const [bayA, shelfA] = getBayAndShelf(a.pick_location);
        const [bayB, shelfB] = getBayAndShelf(b.pick_location);

        //First compare the bays
        const comparedBays = compareBays(bayA, bayB);
        //If the bay comparison succeeds/they are not equivalent
        if (comparedBays !== 0) {
            //We therefore return the value from comparedBays (-1, or 1)
            return comparedBays;
        }

        //If the above is not true, we have the same bay
        //We can simply get the shelf values as integers and find the difference.
        //Negative will mean a comes before b (e.g. 1 - 5)
        //Positive will mean b comes before a (e.g. 5 - 1)
        return parseInt(shelfA) - parseInt(shelfB);
    });
}

//Obtain the correct bay and shelf from the input
function getBayAndShelf(location) {
    //Get the index of the last space
    const lastSpaceIndex = location.lastIndexOf(' ');
    //If there exists a space, meaning the pick_location is a valid format
    if (lastSpaceIndex !== -1) {
        //Separate bay and shelf based on the index location
        const bay = location.substring(0, lastSpaceIndex);
        const shelf = location.substring(lastSpaceIndex + 1);
        return [bay, shelf];
    } else {
        throw new Error(`Invalid pick location format: ${location}`);
    }
}

//Compare the two bays
function compareBays(bayA, bayB) {
    //Get the lengths of the bays
    const bayALength = bayA.length;
    const bayBLength = bayB.length;
    //If they are the same length, simply compare which is further in the alphabet
    if (bayALength === 1 && bayBLength === 1) {
        return bayA.localeCompare(bayB);
    } 
    //Otherwise, if A is a single character, we know it comes before B (B can't be single character)
    else if (bayALength === 1) {
        return -1; //Negative means a before b
    }
    //Otherwise, is B a single character? If so we know it comes before A (A can't be single character)
    else if (bayBLength === 1) {
        return 1; //Positive means a after b
    } 
    //If they are BOTH double character, we can again compare alphabetically
    else {
        return bayA.localeCompare(bayB);
    }
}

//Add repeated product code quantities
function mergeQuantities(products) {
    //Create a new map
    const summary = new Map();
    //For each product, we can use a combined product code and pick location as a key as these are unique to the record.
    products.forEach((product) => {
        const key = `${product.product_code}_${product.pick_location}`;
        //If the mapping exists already (we've seen the product before)
        if (summary.has(key)) {
            //Get the existing quantity for that key and add the new value for THIS product
            summary.set(key, summary.get(key) + parseInt(product.quantity));
        } 
        //If this is the first instance of this product
        else {
            //Set the mapping with the first seen quantity
            summary.set(key, parseInt(product.quantity));
        }
    });

    //Convert map back to array using key and mapped quantities
    return Array.from(summary.entries()).map(([key, quantity]) => {
        //We can now split the key values to get the product code and pick location again
        const [productCode, pickLocation] = key.split('_');
        return {
            product_code: productCode,
            quantity: quantity,
            pick_location: pickLocation
        };
    });
}

//Write the new CSV file
function writeCSV(products, outputPath) {
    //Create a header row using the object keys
    const header = Object.keys(products[0]).join(',');
    //Get the actual product records via mapping
    const rows = products.map((product) => Object.values(product).join(','));
    //Preprend the header with a new line
    const content = [header, ...rows].join('\n');
    //Write the file to the output path
    fs.writeFileSync(outputPath, content);
}

//Main function to run
async function main(inputFilePath) {
    try {
        //Get the initial CSV into the array of products
        const products = await readCSV(inputFilePath);
        //Sort by bay and shelf
        const sortedProducts = sortProductsByLoc(products);
        //Combine like products by quantity
        const mergedProducts = mergeQuantities(sortedProducts);
        //Write the csv file to 'sorted_output.csv'
        writeCSV(mergedProducts, 'sorted_output.csv');
        //Output message
        console.log('CSV file successfully sorted and aggregated.');
    } 
    //Basic error handling
    catch (err) {
        console.error('Error:', err);
    }
}

//Get command line input for the input file
const inputFilePath = process.argv[2];

//Run the code
main(inputFilePath);
