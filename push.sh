user=$(gcloud config get account)
project=$(gcloud config get project)

if [ $user != "jsheneberger@gmail.com" ]; then
  echo Oops! Check login, was $user, expected jsheneberger@gmail.com
  exit 1
fi

if [ $project != "gjmakerspace-org" ]; then 
  echo Oops! Check login, was $project, expected gjmakerspace-org
  exit 1
fi

gcloud builds submit --region us-central1
