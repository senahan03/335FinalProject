const express = require('express');
const path = require('path');
const { argv } = require('process');
const { MongoClient, ServerApiVersion } = require('mongodb');
const qs = require('querystring');
const http = require('https');
require('dotenv').config();

if (!process.env.MONGO_DB_NAME || !process.env.MONGO_COLLECTION || !process.env.MONGO_DB_USERNAME || !process.env.MONGO_DB_PASSWORD) {
    console.error('Missing required environment variables');
    process.exit(1);
}

const databaseAndCollection = { db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION };
const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.bwb5dpt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

(async () => {
  try {
    await client.connect();
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
})();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'views/style.css')))
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', '.ejs');

app.get('/', (request, response) => response.render('index'));

app.get('/studentInformation', (request, response) => response.render('studentInformation'));

app.post('/submitApp', async (request, response) => {
    const { studentname, email, year, lang, secretCodeWord } = request.body;
    try {
        const secretWord = await secretWordTranslate(secretCodeWord);
        await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne({
            studentname,
            email,
            year,
            lang,
            secretWord
        });
        response.render('submitApp', { studentname, email, year, lang, secretWord });
    } catch (error) {
        
    }
});

function secretWordTranslate(word) {
    return new Promise((resolve, reject) => {
          const options = {
              method: 'POST',
              hostname: 'google-translate1.p.rapidapi.com',
              port: null,
              path: '/language/translate/v2',
              headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'Accept-Encoding': 'application/gzip',
                'X-RapidAPI-Key': 'c5122b3877msh58fa085de539f1fp135b9bjsndd8d70bf1a1e',
                'X-RapidAPI-Host': 'google-translate1.p.rapidapi.com'
              }
            };
            
          const req = http.request(options, function (res) {
            const chunks = [];
            
            res.on('data', function (chunk) {
              chunks.push(chunk);
            });
              
            res.on('end', function () {
              const body = Buffer.concat(chunks);
              const translatedSecret = JSON.parse(body.toString()).data.translations[0].translatedText;
              resolve(translatedSecret);
            });
          });
          
          req.write(qs.stringify({
            q: word,
            target: 'es',
            source: 'en'
          }));
          
          req.end();        
    });
}

app.get('/search', async (request, response) => response.render('search'));

app.post('/search', async (request, response) => {
    const { lang } = request.body;
    const criteria = {lang: { $regex: lang }}
    try {
      const allApplicants = client.db(databaseAndCollection.db).collection(databaseAndCollection.collection);
      const filteredApplicants = await allApplicants.find(criteria).toArray();
  
      response.render('displaySR', { applicants: filteredApplicants });
    } catch (error) {
      console.error('Error finding applicants:', error);
      response.send('An error occurred while retrieving applicants');
    }
  });

app.get('/allApplicants', async (request, response) => {
    try {
        const allApplicants = await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).find().toArray();
        response.render('allApplicants', { applicants: allApplicants });
    } catch (error) {
        
    }
});

const portNumber = argv[2];
const prompt = 'Stop to shutdown the server: ';
app.listen(portNumber);
console.log(`Prof Nelson's Secret Server started and running at http://localhost:${portNumber}`);
process.stdin.setEncoding('utf8');

process.stdout.write(prompt);
process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();
        if (command == "stop"){
            client.close();
            process.exit(0);
        } else {
            console.log(`Invalid command: ${command}`);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});

module.exports = app;