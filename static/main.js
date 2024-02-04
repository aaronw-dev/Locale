const showMap = true;
mapboxgl.accessToken = 'pk.eyJ1IjoiYXdkZXYiLCJhIjoiY2xyY3ZkazJqMTNoaTJpc3I2dDAyY2l2eiJ9.tR2w-nBDeG4c8RmntErT2Q';
const reportBox = document.getElementById("report-box")
const issueLocation = document.getElementById("issue-location")
const currenteventPopup = document.getElementById("currentevent-popup")
var isReporting = false;
var issueMarker;
var issueMarkerElement;
var isOpeningPanel = false;
var isPanelOpen = false;

const currentevent_title = document.getElementById("currentevent-title")
const currentevent_location = document.getElementById("currentevent-location")
const currentevent_image = document.getElementById("currentevent-image")
const currentevent_status = document.getElementById("currentevent-status")
const currentevent_watchout = document.getElementById("currentevent-watchout")
const currentevent_risk = document.getElementById("currentevent-risk")
if (showMap) {
    const map = new mapboxgl.Map({
        container: 'dashboard-map', // container ID
        style: 'mapbox://styles/mapbox/satellite-streets-v12', // style URL
        center: [-123.1038, 49.2734], // starting position [lng, lat]
        zoom: 16, // starting zoom
        pitchWithRotate: false,
        dragRotate: false
    });
    map.on('click', (e) => {
        if (isReporting == false && isPanelOpen == false) {
            isReporting = true;

            let el = document.createElement('div');
            let height = 80;
            let width = height;

            el.className = 'marker';
            el.style.backgroundImage = `url(../static/images/logo_notapproved.svg)`;
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
            el.style.backgroundSize = '100%';
            issueMarkerElement = el;
            issueLocation.value = e.lngLat.lng + "," + e.lngLat.lat;
            issueMarker = new mapboxgl.Marker(el)
                .setLngLat(e.lngLat)
                .addTo(map);
            reportBox.classList.remove("closed");
            let panPosition = [e.lngLat.lng, e.lngLat.lat - 0.0001]
            map.panTo(panPosition)
            setTimeout(() => { map.zoomTo(20) }, 500)
        } else {
            if (isOpeningPanel == false) {
                isReporting = false;
                reportBox.classList.add("closed");
                if (issueMarker !== undefined)
                    issueMarker.remove();
                if (isPanelOpen) {
                    currenteventPopup.classList.add("closed");
                    isPanelOpen = false;
                }
            }
        }

    });
    fetch("../getreports", {
        method: "get"
    })
        .then(response => response.json())
        .then(data => {
            for (const [key, value] of Object.entries(data)) {
                let el = document.createElement('div');
                let height = 80;
                let width = height;

                let imageName = ""
                floatValue = value["risk"] / 100
                if (floatValue >= 0.75) //75-100%
                    imageName = "highrisk";
                else if (floatValue >= 0.25) //25-75%
                    imageName = "mediumrisk";
                else if (floatValue >= 0) //0-25%
                    imageName = "lowrisk";
                el.className = 'marker';
                el.style.backgroundImage = `url(../static/images/pin-icons/logo-${imageName}.png)`;
                el.style.width = `${width}px`;
                el.style.height = `${height}px`;
                el.style.backgroundSize = '100%';
                el.onclick = function () {
                    isOpeningPanel = true;
                    openInformationPanel(value.title, value.address_short, value.img_link, value.status, value.watch_out, value.risk)
                }
                let locationSplit = value.location.split(",")
                new mapboxgl.Marker(el)
                    .setLngLat([locationSplit[1], locationSplit[0]])
                    .addTo(map);
            }
        })
}

function changeRisk(e) {
    let floatValue = e.target.value / 100;
    let imageName = ""
    if (floatValue >= 0.9) //90-100%
        imageName = "veryunsafe";
    else if (floatValue >= 0.75) //75-90%
        imageName = "quiteunsafe";
    else if (floatValue >= 0.25) //25-75% (50% range)
        imageName = "unsafe";
    else if (floatValue >= 0.1) //10-25%
        imageName = "slightlyunsafe";
    else if (floatValue >= 0) //0-10%
        imageName = "notunsafe";
    document.documentElement.style.setProperty('--sliderimage', `url(../static/images/safety-icons/${imageName}.png)`);
}
function issueSubmit(e) {
    reportBox.classList.add("closed");
    issueMarker.remove();
    setTimeout(() => {
        reportBox.reset();
    }, 100)
}

function openInformationPanel(t, l, i, s, w, r) {
    currenteventPopup.classList.remove("closed")
    currentevent_title.innerText = t;
    currentevent_location.innerText = l;
    currentevent_image.src = i;
    currentevent_status.innerText = s;
    currentevent_watchout.innerText = w;
    currentevent_risk.style.marginLeft = `${r}%`
    isPanelOpen = true;
    setTimeout((e) => {
        isOpeningPanel = false;
    }, 100)
}