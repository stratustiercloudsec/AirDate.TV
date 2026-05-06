#!/bin/bash

# Configuration
TARGET_DIR="/var/www/html/airdate-react/src/lambda_functions"
SEARCH_PATTERN="[Aa]ir[Ee]?date"
INTERNAL_FILE="lambda_function.py" # The file inside the zip you want to extract
TEMP_DIR="/tmp/lambda_extract"

# Create directories
mkdir -p "$TARGET_DIR"
mkdir -p "$TEMP_DIR"

echo "Searching for Lambda functions..."

aws lambda list-functions --query 'Functions[].FunctionName' --output text | tr '\t' '\n' | grep -E "$SEARCH_PATTERN" | while read -r FUNCTION_NAME; do
    
    echo "------------------------------------------"
    echo "Processing: $FUNCTION_NAME"
    
    # Get the download URL
    DOWNLOAD_URL=$(aws lambda get-function --function-name "$FUNCTION_NAME" --query 'Code.Location' --output text)
    
    if [ -n "$DOWNLOAD_URL" ]; then
        # 1. Download the zip to a temp location
        curl -s -o "$TEMP_DIR/$FUNCTION_NAME.zip" "$DOWNLOAD_URL"
        
        # 2. Extract only the specific .py file from the zip
        # -j (junk paths) prevents creating subfolders from the zip
        unzip -oqj "$TEMP_DIR/$FUNCTION_NAME.zip" "$INTERNAL_FILE" -d "$TEMP_DIR"
        
        # 3. Move and rename it to the target directory
        if [ -f "$TEMP_DIR/$INTERNAL_FILE" ]; then
            mv "$TEMP_DIR/$INTERNAL_FILE" "$TARGET_DIR/$FUNCTION_NAME.py"
            echo "Success: Created $FUNCTION_NAME.py"
        else
            echo "Warning: Could not find $INTERNAL_FILE inside the ZIP for $FUNCTION_NAME"
        fi
        
        # Clean up the zip
        rm "$TEMP_DIR/$FUNCTION_NAME.zip"
    else
        echo "Error: Failed to get download URL for $FUNCTION_NAME"
    fi

done

# Cleanup temp directory
rm -rf "$TEMP_DIR"
echo "------------------------------------------"
echo "Export complete."
