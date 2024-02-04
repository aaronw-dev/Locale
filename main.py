import re
import string
from threading import Timer
import traceback
import urllib.parse
import datetime
import os
from discord_webhook import DiscordWebhook
import json
from flask import Flask, render_template, request, redirect, session, make_response, abort
import requests
import emailsend
import logging
import firebase_admin
from firebase_admin import firestore, credentials, storage
from google.cloud.firestore import GeoPoint
import random
from random import randint
from argon2 import PasswordHasher, exceptions

from pytz import timezone
import pytz


def generaterandomid(length):
    range_start = 10**(length-1)
    range_end = (10**length)-1
    return randint(range_start, range_end)


def generate_cookie(length):
    cookie = ''.join(
        random.choice(
            string.ascii_uppercase +
            string.ascii_lowercase +
            string.digits
        ) for _ in range(length)
    )
    return cookie


# Application Default credentials are automatically created.
cred = credentials.Certificate("./fbkey.json")
firebase_app = firebase_admin.initialize_app(cred, {
    'storageBucket': 'cbr-2024.appspot.com'
})
bucket = storage.bucket()
db = firestore.client()
ph = PasswordHasher()
cookies = {}
cookieDuration = 3600  # Value in seconds

# logging.getLogger("werkzeug").disabled = True
app = Flask(__name__)
app.secret_key = generate_cookie(50)


@app.route('/')
def homepage():
    return render_template('home-page.html')


@app.route('/account')
def account():
    return render_template("account.html")


@app.route("/terms-conditions")
def termsandconditions():
    return render_template("terms_and_conditions.html")


def deleteCookie(key):
    cookies.remove(key)


def hasModerator(uid):
    docs_ref = db.collection("users").document(uid)
    doc = docs_ref.get()
    doc = doc.to_dict()
    return doc["moderator"]


@app.route("/loginwithcookie", methods=["POST"])
def loginwithcookie():
    request_content = request.json
    cookie = request_content["cookie"]
    return_status = {
        "status": "",  # can be "success" or "failed"
        "reason": "",  # reason for failed authentication - e.g. "empty-email" or "invalid-password"
    }
    if cookie in cookies:
        return_status["status"] = "success"
    else:
        return_status["reason"] = "invalid-cookie"
    return return_status


@app.route("/login", methods=["POST"])
def login():
    docs_ref = db.collection("users")
    docs = docs_ref.stream()
    request_content = request.form.to_dict()
    error_reason = ""
    return_status = {
        "status": "",  # can be "success" or "failed"
        "reason": "",  # reason for failed authentication - e.g. "empty-email" or "invalid-password"
        "cookie": ""
    }
    for doc in docs:
        user_info = doc.to_dict()
        user_id = doc.id
        hash = user_info["password"]
        try:
            ph.verify(hash, request_content["password"])
            if (request_content["email"] == user_info["email"]):
                if request_content["email"].isspace():
                    error_reason = "empty-email"
                    raise Exception
                if request_content["password"].isspace():
                    error_reason = "empty-password"
                    raise Exception
                if not user_info["email-verified"]:
                    print(user_info["email-verified"])
                    error_reason = "not-verified"
                    raise Exception
                return_status["status"] = "success"

                now = (
                    datetime.datetime.utcnow() +
                    datetime.timedelta(seconds=cookieDuration)
                ).strftime("%a, %d %b %Y %H:%M:%S UTC")
                cookie = generate_cookie(40)
                full_cookie = f"cookie={cookie}; expires={now}"
                return_status["cookie"] = full_cookie
                cookies[cookie] = {"user": user_id}
                t = Timer(cookieDuration,
                          deleteCookie, args=[cookie])
                t.start()
                return return_status
            else:
                error_reason = "invalid-email"
                raise Exception
        except Exception as e:
            print(e)
            if (error_reason == ""):
                error_reason = "invalid-password"
            pass
    return_status["status"] = "failed"
    return_status["reason"] = error_reason
    return return_status


@app.route("/app")
def main_app():
    user_cookie = request.cookies.get('cookie')
    if (user_cookie in cookies):
        print("User logged in with cookie: " + user_cookie)
        if (hasModerator(cookies[user_cookie]["user"])):
            return render_template("mod-dash.html")
        return render_template("main.html")
    else:
        return redirect("../account")


@app.route("/signup", methods=["POST"])
def signup():
    request_content = request.form.to_dict()
    random_id = generaterandomid(10)
    # print("RANDOM ID: " + str(random_id))
    hashed_password = ph.hash(request_content["password"])
    # print("HASH: " + hashed_password)
    username = request_content["username"]
    user_email = request_content["email"]
    user_data = {
        "username": username,
        "password": hashed_password,
        "email": user_email,
        "email-verified": False,
        "moderator": False
    }
    db.collection("users").document(str(random_id)).set(user_data)
    verification_link = f"http://127.0.0.1:5000/verify/{random_id}"
    emailsend.sendEmail(
        user_email,
        "Account Verification",
        "<!DOCTYPE html> <html lang='en'> <head> <meta charset='UTF-8'> <meta name='viewport' content='width=device-width,initial-scale=1'> <title>Email Verification</title> <style>.btn-home:hover {background-color:#5ad35e}</style> </head> <body style='font-family:Arial, sans-serif'> <div class='container' style='background-color:#6095e2; border-radius:8px; box-shadow:0 0 10px rgba(0, 0, 0, 0.1); height:fit-content; margin:auto; padding:50px; text-align:center; width:fit-content' bgcolor='#6095e2' height='fit-content' align='center' width='fit-content'> <div class='subcontainer' style='top:50%'> <h2 style='color:#000; margin:0'>Welcome!</h2> <div class='thank-you-message' style='color:#000; font-size:18px; margin-bottom:20px; margin-top:20px; text-align:center' align='center'> Hello, " + username + ". <br> Thank you for signing up for Locale. <br> Click the button below to verify your email address. </div> <a href='" + verification_link + "' style='cursor:pointer'><button class='btn-home' style='background-color:#55be59; border:none; border-radius:4px; color:#fff; font-size:16px; margin:0; margin-left:auto; margin-right:auto; padding:10px 20px; width:300px' bgcolor='#55be59' width='300'>Verify email</button></a> </div> </div> </body> </html>")
    return redirect("../account")


@app.route("/getreports")
def getreports():
    user_cookie = request.cookies.get('cookie')
    if (user_cookie in cookies):
        docs_ref = db.collection("issues")
        docs = docs_ref.get()
        all_reports = {}
        for doc in docs:
            id = doc.id
            doc = doc.to_dict()
            for key in doc:
                if isinstance(doc[key], firebase_admin.firestore.GeoPoint):
                    doc[key] = str(doc[key].latitude) + ',' + \
                        str(doc[key].longitude)
                    continue
            if (doc["approved"]):
                all_reports[id] = doc
        return all_reports
    else:
        abort(401)


@app.route("/report", methods=["POST"])
def report():

    user_cookie = request.cookies.get('cookie')
    if (user_cookie in cookies):
        try:
            report_id = str(generaterandomid(30))
            request_form = request.form.to_dict()
            print(request_form)
            mb_token = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{request_form['location']}.json?access_token=pk.eyJ1IjoiYXdkZXYiLCJhIjoiY2xyY3ZkazJqMTNoaTJpc3I2dDAyY2l2eiJ9.tR2w-nBDeG4c8RmntErT2Q"
            uploaded_file = request.files['image']
            if uploaded_file.filename != '':
                if not os.path.isdir("./uploadedimage"):
                    os.mkdir("./uploadedimage")
                save_path = f"./uploadedimage/{uploaded_file.filename}"
                uploaded_file.save(save_path)
                blob = bucket.blob(report_id)
                blob.upload_from_filename(save_path)
                blob.make_public()
                os.remove(save_path)
            geocode_response = requests.get(mb_token).json()
            gc_address = geocode_response["features"][0]["place_name"]
            location = request_form['location'].split(",")
            report_data = {
                "address": gc_address,
                "address_short": gc_address.split(",")[0],
                "approved": False,
                "location": GeoPoint(float(location[1]), float(location[0])),
                "risk": float(request_form['risk']),
                "status": "active",
                "title":  request_form['title'],
                "watch_out": request_form['description'],
                "img_link": blob.public_url,
            }
            db.collection("issues").document(report_id).set(report_data)
            return "Thanks!"
        except Exception as e:
            print(traceback.format_exc())
            return traceback.format_exc()
    else:
        abort(401)


@app.route("/verify/<id>")
def verifyuser(id):
    user_ref = db.collection("users").document(id)
    user = user_ref.get()
    if (user.exists):
        user_ref.set({"email-verified": True}, merge=True)
    else:
        print("User does not exist.")
    return redirect("../account")


@app.errorhandler(500)
def fivehundrederror(error):
    return render_template("error.html", errorcode=error)


@app.errorhandler(401)
def fivehundrederror(error):
    return render_template("error.html", errorcode=error)


@app.errorhandler(404)
def invalid_route(error):
    return render_template("error.html", errorcode="404 resource not found")


app.run(host='0.0.0.0', port=5000, debug=False)
