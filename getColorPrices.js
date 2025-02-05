import * as cheerio from 'cheerio';
// curl -X GET --header 'Accept: application/json' --header 'Authorization: key XXXX' 'https://rebrickable.com/api/v3/lego/colors/?page_size=300' > src/data/lego-colors.json
import colors from "./lego-colors.json" with { "type": "json" };
import fs from 'fs/promises';
import path from 'path';

// Brick 2 x 4 part ID
const PART_ID = "264";

// Define the data groups and value types
const VALUES_GROUP_TYPE = ["last6MonthsNew", "last6MonthsUsed", "currentNew", "currentUsed"];
const VALUE_TYPES = ["timesSold", "totalQty", "minPrice", "avgPrice", "qtyAvgPrice", "maxPrice"];

// Limit the number of colors for a dry run
const DRY_RUN = false;

// Resolve paths relative to the script's directory
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const CACHE_DIR = path.join(SCRIPT_DIR, 'cached');
const OUTPUT_FILE = path.join(CACHE_DIR, 'colors.json');

// Check if the file already exists
// const checkIfFileExists = async (filePath) => {
//   try {
//     await fs.access(filePath);
//     return true; // File exists
//   } catch {
//     return false; // File does not exist
//   }
// };

// Function to fetch and parse data for a specific part and color
const fetchDataForColor = async (color) => {
  const colorId = color.external_ids?.BrickLink?.ext_ids?.[0];
  if (!colorId) {
    console.error(`Skipping color ${color.name}: Missing BrickLink ID`);
    return null;
  }

  const url = `https://www.bricklink.com/v2/catalog/catalogitem_pgtab.page?idItem=${PART_ID}&idColor=${colorId}&st=2&gm=0&gc=0&ei=0&prec=2&showflag=0&showbulk=0&currency=2`;
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse the summary row data
    const summaryRow = $(".pcipgMainTable").find("tr").eq(2).children();
    const finalData = {
      name: color.name,
      rgb: color.rgb,
      is_trans: color.is_trans,
      colorId,
    };

    summaryRow.each((columnIndex, column) => {
      VALUE_TYPES.forEach((valueType, valueTypeIndex) => {
        const value = $(column).find("tr").eq(valueTypeIndex).find("td").eq(1).text().trim();
        const valueId = [VALUES_GROUP_TYPE[columnIndex], valueType].join("_");
        finalData[valueId] = parseFloat(value.replace(/[^0-9.]/g, ''));
      });
    });

    return finalData;
  } catch (error) {
    console.error(`Failed to fetch data for color ${color.name} (${colorId}):`, error);
    return null;
  }
};

// Main function to process all colors with optional limit
const processAllColors = async () => {
  // // Check if the file already exists
  // if (!DRY_RUN && await checkIfFileExists(OUTPUT_FILE)) {
  //   const cachedData = await fs.readFile(OUTPUT_FILE, 'utf-8');
  //   process.stdout.write(cachedData); // Print only the cached data to stdout
  //   return;
  // }

  // // Ensure the cache directory exists
  // await fs.mkdir(CACHE_DIR, { recursive: true });

  const results = [];
  const limitedColors = colors.results.slice(0, DRY_RUN ? 10 : Number.POSITIVE_INFINITY); // Limit the number of colors

  for (const color of limitedColors) {
    try {
      const data = await fetchDataForColor(color);
      if (data) results.push(data);
    } catch (error) {
      console.error(`Error processing color ${color.name}:`, error);
    }
  }

  // Write the results to a JSON file
  try {
    // await fs.writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf-8');
    process.stdout.write(JSON.stringify(results, null, 2)); // Print the results to stdout
    console.error(`Data successfully written to ${OUTPUT_FILE}`);
  } catch (error) {
    console.error("Failed to write data to file:", error);
  }
};

// Run the script
processAllColors();
