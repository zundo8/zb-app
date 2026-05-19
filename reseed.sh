#!/bin/bash

# Reseed the email templates by calling the DELETE route on the local API
echo "Reseeding email templates in the database..."
curl -X DELETE http://localhost:3000/api/email/templates
echo -e "\nReseed complete."
