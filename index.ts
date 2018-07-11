#!/usr/bin/env node
"use strict";

var http = require("http");
var sa = require('superagent');

// ----- caricamento delle configurazioni definite nel file .env ----- //
const dotenv = require("dotenv");
dotenv.config();
// ----- fine caricamento delle configurazioni definite nel file .env ----- //

// ----- implementazione oggetto in cui si trovano informazioni App ----- //
class Settings {
  version: string;
  sessionID: string;
  expressPort: number;
  rasaIP: string;
  rasaPort: number;
  springIP: string;
  springPort: number;

  constructor(
    version: string,
    sessionID: string,
    expressPort: number,
    rasaIP: string,
    rasaPort: number,
    springIP: string,
    springPort: number
  ) {
    this.version = version;
    this.sessionID = sessionID;
    this.expressPort = expressPort;
    this.rasaIP = rasaIP;
    this.rasaPort = rasaPort;
    this.springIP = springIP;
    this.springPort = springPort;
  }
}

const settingsApp: Settings = new Settings(
  process.env.VERSION_APP,
  process.env.SESSION_ID,
  process.env.SERVER_PORT_EXPRESS,
  process.env.SERVER_IP_RASA,
  process.env.SERVER_PORT_RASA,
  process.env.SERVER_IP_SPRING,
  process.env.SERVER_PORT_SPRING
);
// ----- fine implementazione oggetto in cui si trovano informazioni App ----- //

// ----- creazione server ----- //
var express = require("express");
var app = express();

app.use(express.static(__dirname));
app.get("/", function(req, res) {
  console.log("**** new request ****");
  res.sendFile("index.html");
});

const server = app.listen(settingsApp.expressPort, () => {
  console.log(
    "Express server listening on port %d in %s mode",
    server.address().port,
    app.settings.env
  );
  console.log(
    "Rasa backend on %s:%d",
    settingsApp.rasaIP,
    settingsApp.rasaPort
  );
  console.log(
    "Spring backend on %s:%d",
    settingsApp.springIP,
    settingsApp.springPort
  );
});
// ----- fine creazione server ----- //

// ----- gestione comunicazione tramite socket ----- //
const socketManager = require("socket.io");
var socketIOServer = new socketManager(server);

socketIOServer.on("connection", socket => {
  socket.on("userMessage", (messageReceive: string) => {
    console.log("*** Processing message: " + messageReceive + "****");
    /*
      qui deve essere gestita la richiesta dell'utente andando a
      chiamare il backend rasa che gestira la richiesta rispondendo
      con un json in cui saranno definiti gli intenti e le entità
      della richiesta
      */

    // esempio di richiesta al backend rasa_nlu
    var botResponse: string = "?????";
    rasaRequest += messageReceive;

    /* esecuzione della post al server di rasa che eseguirà il parse del
     messaggio dell'utente*/
    sa.post('http://' + settingsApp.rasaIP + ':' + settingsApp.rasaPort +
        '/conversations/default/parse')
      .set('Content-Type', 'application/json')
      .send({
        "query": messageReceive
      })
      .end(function(err, res) {
        var arr = res.text;
        console.log(arr);
        botResponse = JSON.parse(res.text);
      });
    /* una volta che viene mandato la post per un parse di un messaggio
    dell'utente rasa risponderà con una azione da fare */
    // per eseguire l'azione eseguiamo una post di questo tipo
    sa.post('http://' + settingsApp.rasaIP + ':' + settingsApp.rasaPort +
        '/conversations/default/continue')
      .set('Content-Type', 'application/json')
      .send({
        "executed_action": "actions.ActionSaluta"
      })
      .end(function(err, res) {
        var arr = res.text;
        console.log(arr);
        botResponse = JSON.parse(res.text);
      });
    /* ovviamente al posto del actions.ActionSaluta ci sarà l'azione successiva
    alla precedente, che viene contenuta all'interno della risposta alla posto
    precedente nel campo next_action */
    /* rasa deve ricevere comandi fintanto che il campo next_action non
    diventa action_listen */


    // esempio di richiesta al backend spring
    var requestToSpring: string =
      "http://" +
      settingsApp.springIP +
      ":" +
      settingsApp.springPort +
      "/v1/api/dataById?id=12";

    http
      .get(requestToSpring, resp => {
        console.log("Spring response");
        let data = "";

        resp.on("data", chunk => {
          data += chunk;
        });

        resp.on("end", () => {
          console.log(JSON.parse(data));
        });
      })
      .on("error", err => {
        console.log("Error: " + err.message);
      });

    // appena si ha il risultato della richeista dell'utente allora si manda la risposta all'utente
    console.log("**** Bot response: " + botResponse + " ****");
    socket.emit("botResponse", botResponse);
  });
});
// ----- fine gestione comunicazione tramite socket ----- //
