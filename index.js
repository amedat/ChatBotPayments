#!/usr/bin/env node
"use strict";
var http = require("http");
var sa = require("superagent");
// ----- caricamento delle configurazioni definite nel file .env ----- //
var dotenv = require("dotenv");
dotenv.config();
// ----- fine caricamento delle configurazioni definite nel file .env ----- //
// ----- implementazione oggetto in cui si trovano informazioni App ----- //
var Settings = /** @class */ (function () {
    function Settings(version, sessionID, expressPort, rasaIP, rasaPort) {
        this.version = version;
        this.sessionID = sessionID;
        this.expressPort = expressPort;
        this.rasaIP = rasaIP;
        this.rasaPort = rasaPort;
    }
    return Settings;
}());
var settingsApp = new Settings(process.env.VERSION_APP, process.env.SESSION_ID, process.env.SERVER_PORT_EXPRESS, process.env.SERVER_IP_RASA, process.env.SERVER_PORT_RASA);
// ----- fine implementazione oggetto in cui si trovano informazioni App ----- //
// ----- Gestione comunicazione con rasa core ---- //
var comunicationRasaManager = /** @class */ (function () {
    function comunicationRasaManager() {
    }
    comunicationRasaManager.questionAndAnswer = function (socket, message, rasaAddress, userID) {
        try {
            sa.post(rasaAddress + "/conversations/" + userID + "/parse")
                .set("Content-Type", "application/json")
                .send({
                query: message
            })
                .end(function (err, res) {
                try {
                    var arr = JSON.parse(res.text);
                    console.log("Sender: " + arr.tracker["sender_id"]);
                    console.log("next_action: " + arr.next_action);
                    if (arr.next_action != "action_listen") {
                        sa.post(rasaAddress + "/conversations/" + userID + "/respond")
                            .set("Content-Type", "application/json")
                            .send({
                            query: message
                        })
                            .end(function (err, res) {
                            var arrt = JSON.parse(res.text);
                            console.log("botResponse: " + arrt[0].text);
                            socket.emit("botResponse", arrt[0].text);
                            return;
                        });
                    }
                    else {
                        socket.emit("botResponse", "Puoi cercare di essere più chiaro?");
                        return;
                    }
                }
                catch (err) {
                    console.log("errore: " + err);
                    socket.emit("botResponse", "In questo momento il servizio non è attivo, riprovare più tardi!");
                    return;
                }
            });
        }
        catch (err) {
            console.log("**** C'è stato un errore durante la chiamata verso rasa ****");
            console.log("errore: " + err);
            socket.emit("botResponse", "In questo momento il servizio non è attivo, riprovare più tardi!");
            return;
        }
    };
    comunicationRasaManager.conversationReset = function (socket, rasaAddress, userID) {
        try {
            sa.post(rasaAddress + "/conversations/" + userID + "/continue")
                .set("Content-Type", "application/json")
                .send({
                events: [{ event: "restart" }]
            })
                .end(function (err, res) {
                console.log("**** reset conversation ****");
                socket.emit("botResponse", "La conversazione è stata cancellata");
            });
        }
        catch (err) {
            console.log("**** C'è stato un errore durante la chiamata verso rasa ****");
            console.log("errore: " + err);
            socket.emit("botResponse", "In questo momento il servizio non è attivo, riprovare più tardi!");
            return;
        }
    };
    return comunicationRasaManager;
}());
// ----- ----- //
// ----- creazione server ----- //
var express = require("express");
var app = express();
app.use(express.static(__dirname));
app.get("/", function (req, res) {
    console.log("**** new request ****");
    res.sendFile("index.html");
});
var server = app.listen(settingsApp.expressPort, function () {
    console.log("Express server listening on port %d in %s mode", server.address().port, app.settings.env);
    console.log("Rasa backend on %s:%d", settingsApp.rasaIP, settingsApp.rasaPort);
});
// ----- fine creazione server ----- //
// ----- gestione comunicazione tramite socket ----- //
var socketManager = require("socket.io");
var socketIOServer = new socketManager(server);
socketIOServer.on("connection", function (socket) {
    socket.on("userMessage", function (messageReceive) {
        console.log("*** Processing message: " + messageReceive + "****");
        /*
          qui deve essere gestita la richiesta dell'utente andando a
          chiamare il backend rasa che gestira la richiesta rispondendo
          con un json in cui saranno definiti gli intenti e le entità
          della richiesta
          */
        // esempio di richiesta al backend rasa_nlu
        var rasaAddress = "http://" + settingsApp.rasaIP + ":" + settingsApp.rasaPort;
        var userID = socket.id;
        if (messageReceive != "conversation reset default") {
            /* esecuzione della post al server di rasa che eseguirà il parse del
           messaggio dell'utente*/
            comunicationRasaManager.questionAndAnswer(socket, messageReceive, rasaAddress, userID);
        }
        else {
            comunicationRasaManager.conversationReset(socket, rasaAddress, userID);
        }
    });
});
