# Calliope

Einfache Webanwendung zur Steuerung eines Calliope mini per Bluetooth Low Energy.

# Was brauche ich außer dem repo zum testen ? 

Docker!
bei jedem change auf main wird das docker image angepasst und hochgeladen, zum testen müssen wir lediglich 
docker run -d --name calliope -p 5000:5000 ghcr.io/niklasgehlen/calliope:latest ausführen 
und es auf port 5000 uns anschauen ! 
http://localhost:5000


alternativ falls keine docker umgebung vorhanden ist in der index.html die js und css datei normal einbinden und via .html testen, vorm pushen bitte zurückändern!


todo: schöne doku
in /templates/index.html  ist das frontend, die app.py stellt das backend da.


