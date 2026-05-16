#!/attr/bin/env bash

set -e

# The ci_post_clone.sh script is executed after Xcode Cloud clones the repository.
# It is used to install dependencies for React Native projects.

echo "--- Installing Node.js dependencies ---"
cd ../.. # Move from ios/ci_scripts to project root
npm install

echo "--- Installing CocoaPods ---"
cd ios
pod install

echo "--- Post-clone script completed ---"
