// Elemente & Konstanten

let rxCharacteristic = null;

const statusBox = document.getElementById("status");

const lifterSlider = document.getElementById("lifterSlider");
const lifterValue = document.getElementById("lifterValue");

// Groesster erlaubter Anzeige-/Servo-Wert
const LIFTER_MAX = 110;

// Schrittweite fuer die Pfeile (in Grad)
const LIFTER_STEP = 10;
// Fahrbuttons: welcher Button sendet welchen Befehl
const driveMap = {
    upBtn:    { press: "UP",    release: "up"    },
    downBtn:  { press: "DOWN",  release: "down"  },
    leftBtn:  { press: "LEFT",  release: "left"  },
    rightBtn: { press: "RIGHT", release: "right" }
};


// Bluetooth: verbinden & senden

async function connectBluetooth() {

    try {

        const serviceUuid = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";

        statusBox.textContent = "Verbinde...";

        // Geraet auswaehlen
        const device = await navigator.bluetooth.requestDevice({
            filters: [{
              namePrefix: "Calliope",
            }],
            optionalServices: [serviceUuid]
        });

        // Verbindung herstellen und UART-Service holen
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(serviceUuid);

        // Erste beschreibbare Characteristic suchen
        const characteristics = await service.getCharacteristics();

        rxCharacteristic = characteristics.find(
            characteristic =>
                characteristic.properties.write ||
                characteristic.properties.writeWithoutResponse
        );

        if (!rxCharacteristic) {
            throw new Error("Keine beschreibbare Characteristic gefunden");
        }

        statusBox.textContent = "Verbunden";

    } catch (error) {
        console.error(error);
        statusBox.textContent = "Verbindung fehlgeschlagen";
    }
}

// Befehl senden
async function send(command) {

    if (!rxCharacteristic) {
        return;
    }

    try {// Befehle werden in Bytes umgewandelt
        const data = new TextEncoder().encode(command + "\n");
        //Sendet Bytes ohne auf Bestätigung zu warten
        await rxCharacteristic.writeValueWithoutResponse(data);

    } catch (error) {
        console.error(error);
        statusBox.textContent = "Senden fehlgeschlagen";
    }
}

document
    .getElementById("connectBtn")
    .addEventListener("click", connectBluetooth);



// Fahren starten (Button optisch aktiv, "press" senden)
// das active tag ist einfach dafür da das während der knopf gedürckt wird der button kleiner bleibt
// er holt sich aus der drive map den passenden befehl
function driveStart(id) {
    document.getElementById(id).classList.add("active");
    send(driveMap[id].press);
}

// Fahren stoppen (Button optisch normal, "release" senden)
function driveStop(id) {
    document.getElementById(id).classList.remove("active");
    send(driveMap[id].release);
}

// Maus/Touch an einen Fahrbutton binden
function bindDriveButton(id) {

    const button = document.getElementById(id);

    button.addEventListener("pointerdown", () => driveStart(id));
    button.addEventListener("pointerup", () => driveStop(id));
    button.addEventListener("pointerleave", () => driveStop(id));
}

for (const id of Object.keys(driveMap)) {
    bindDriveButton(id);
}

// Selbstfahren (Umschalter)

let selfDriveOn = false;

const selfDriveBtn = document.getElementById("selfDriveBtn");

selfDriveBtn.addEventListener("click", () => {

    selfDriveOn = !selfDriveOn;

    if (selfDriveOn) {
        send("SELFDRIVEON");
        selfDriveBtn.textContent = "Selbstfahren: AN";
        selfDriveBtn.classList.add("on");
    } else {
        send("SELFDRIVEOFF");
        selfDriveBtn.textContent = "Selbstfahren: AUS";
        selfDriveBtn.classList.remove("on");
    }
});


// Kurzes optisches Feedback fuer einen Button geben
function flashButton(id) {
    const button = document.getElementById(id);
    button.classList.add("active");
    setTimeout(() => button.classList.remove("active"), 120);
}

document
    .getElementById("turtleBtn")
    .addEventListener("click", () => {
        send("SCHILDKROETE");
        flashButton("turtleBtn");
    });

document
    .getElementById("rabbitBtn")
    .addEventListener("click", () => {
        send("HASE");
        flashButton("rabbitBtn");
    });


// Heber (Slider & Pfeile)

// Zahl auf 3 Stellen mit fuehrenden Nullen bringen (z. B. 90 -> "090")
function pad3(value) {
    return String(value).padStart(3, "0");
}

// Heber setzen, anzeigen und senden.
// displayValue = das, was der Nutzer sieht (0..LIFTER_MAX).
// Der echte Servo-Winkel ist gedreht: servo = LIFTER_MAX - displayValue.
function updateLifter(displayValue) {

    // Wert in gueltigen Bereich klemmen (0..110)
    displayValue = Math.max(0, Math.min(LIFTER_MAX, Math.round(displayValue)));

    lifterSlider.value = displayValue;
    lifterValue.textContent = displayValue + "\u00B0"; // Grad-Zeichen

    // Anzeige umdrehen -> echter Servo-Winkel, Format "c" + 3 Ziffern
    const servo = LIFTER_MAX - displayValue;
    send("c" + pad3(servo));
}

// Heber um einen Schritt bewegen (positiv = hoch, negativ = runter)
function moveLifter(step) {
    updateLifter(Number(lifterSlider.value) + step);
}

// Slider: sendet live den Wert
lifterSlider.addEventListener("input", () => {
    updateLifter(Number(lifterSlider.value));
});

// Pfeil hoch -> Heber hoch
document
    .getElementById("lifterUpBtn")
    .addEventListener("click", () => moveLifter(LIFTER_STEP));

// Pfeil runter -> Heber runter
document
    .getElementById("lifterDownBtn")
    .addEventListener("click", () => moveLifter(-LIFTER_STEP));
