const express = require("express");
const cors = require("cors");
const app = express();
const port = 5000;
require("dotenv").config();

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri = process.env.MONGO_DB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db(process.env.DB_NAME);
    const opportunitiesCollection = database.collection("opportunities");
    const startupCollection = database.collection("startup");
    const userCollection = database.collection("user");

    app.get("/api/users", async (req, res) => {
      const result = await userCollection.find().skip(2).toArray();
      res.send(result);
    })

    //opportunities related Api
    app.get("/api/opportunities", async (req, res) => {
      const query = {};
      if (req.query.startupId) {
        query.startupId = req.query.startupId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
      const result = await opportunitiesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/api/opportunities/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await opportunitiesCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/opportunities", async (req, res) => {
      const opportunity = req.body;
      const result = await opportunitiesCollection.insertOne(opportunity);
      res.send(result);
    });

    app.patch("/api/opportunities/:id", async (req, res) => {
      const { id } = req.params;
      const updatedOpportunity = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedOpportunity,
      };
      const result = await opportunitiesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    app.delete("/api/opportunities/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await opportunitiesCollection.deleteOne(query);
      res.send(result);
    });

    //startup related Api
    app.get("/api/startups", async (req, res) => {
      const result = await startupCollection.find().skip(1).toArray();
      res.send(result);
    })
    app.get("/api/my/startup", async (req, res) => {
      const query = {};
      if (req.query.founderId) {
        query.founderId = req.query.founderId;
      }
      const result = await startupCollection.findOne(query);

      res.send(result || {});
    });
    app.post("/api/startup", async (req, res) => {
      const startup = req.body;
      const newStartup = {
        ...company,
        createdAt: new Date(),
      };
      const result = await startupCollection.insertOne(newStartup);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
