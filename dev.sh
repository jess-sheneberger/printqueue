pushd js
yarn install
yarn run build
if [ $? -ne 0 ]; then 
  popd
  exit 1
fi
popd 

go build 

GOOGLE_APPLICATION_CREDENTIALS=/Users/johnsheneberger/Downloads/gjmakerspace-org-printqueueup.json ./printqueue -serve