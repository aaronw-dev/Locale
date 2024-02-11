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
var currentLat;
var currentLong;
var currentMarker;
const currentevent_title = document.getElementById("currentevent-title")
const currentevent_location = document.getElementById("currentevent-location")
const currentevent_image = document.getElementById("currentevent-image")
const currentevent_status = document.getElementById("currentevent-status")
const currentevent_watchout = document.getElementById("currentevent-watchout")
const currentevent_risk = document.getElementById("currentevent-risk")

function showPosition(position) {
    currentLat = position.coords.latitude;
    currentLong = position.coords.longitude;
}
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showPosition);
}
setTimeout((e) => {
    if (showMap) {
        const map = new mapboxgl.Map({
            container: 'dashboard-map', // container ID
            style: 'mapbox://styles/mapbox/satellite-streets-v12', // style URL
            center: [currentLong, currentLat], // starting position [lng, lat]
            zoom: 16, // starting zoom
            pitchWithRotate: false,
            dragRotate: false
        });
        let el = document.createElement('div');
        let height = 80;
        let width = height;
        el.className = 'marker';
        el.style.backgroundImage = `url(../static/images/logo.svg)`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.backgroundSize = '100%';
        userMarker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
            .setLngLat([currentLong, currentLat])
            .addTo(map);
        function updateMarker(position) {
            currentLat = position.coords.latitude;
            currentLong = position.coords.longitude;
            userMarker.setLngLat([currentLong, currentLat])
        }
        if (navigator.geolocation) {
            navigator.geolocation.watchPosition(updateMarker);
        }
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
                issueMarker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
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
                        currentMarker.classList.remove("current-marker")
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
                    let locationSplit = value.location.split(",")
                    el.onclick = function () {
                        isOpeningPanel = true;
                        currentMarker = this;
                        openInformationPanel(value.title, value.address_short, value.img_link, value.status, value.watch_out, value.risk);
                        let panPosition = [locationSplit[1], locationSplit[0]];
                        map.panTo(panPosition);
                        setTimeout(() => { map.zoomTo(19) }, 500)
                        this.classList.add("current-marker")
                    }
                    new mapboxgl.Marker({ element: el, anchor: "bottom" })
                        .setLngLat([locationSplit[1], locationSplit[0]])
                        .addTo(map);
                }
            })
    }
}, 100)

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
    console.log(issueMarker)
    let el = document.createElement('div');
    let height = 80;
    let width = height;
    el.className = 'marker';
    el.style.backgroundImage = `url(../static/images/logo_notapproved.svg)`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.backgroundSize = '100%';
    new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat(issueMarker.getLngLat())
        .addTo(map);
    setTimeout(() => {
        issueMarker.remove();
        reportBox.reset();
    }, 600)
}

function openInformationPanel(t, l, i, s, w, r) {
    currenteventPopup.classList.remove("closed")
    currentevent_title.innerText = t;
    currentevent_location.innerText = l;
    currentevent_image.src = i;
    currentevent_status.innerText = s;
    currentevent_watchout.innerText = w;
    currentevent_risk.style.marginLeft = `${r}%`

    floatValue = r / 100
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
    let image_url = `../static/images/safety-icons/${imageName}.png`
    currentevent_risk.src = image_url
    isPanelOpen = true;
    setTimeout((e) => {
        isOpeningPanel = false;
    }, 100)
}