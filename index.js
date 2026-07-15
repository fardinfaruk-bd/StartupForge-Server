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
    const applicationCollection = database.collection("application");
    const plansCollection = database.collection("plans");
    const paymentCollection = database.collection("payment");

    app.get("/api/users", async (req, res) => {
      const result = await userCollection.find().skip(2).toArray();
      res.send(result);
    });

    app.patch("/api/users/:id", async (req, res) => {
      const id  = req.params.id;
      const updatedUser = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedUser,
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    })

    //opportunities related Api
    app.get("/api/opportunities", async (req, res) => {
      console.log("server side q", req.query);
      const query = {};
      if (req.query.search) {
        query.$or = [
          { roleTitle: { $regex: req.query.search, $options: "i" } },
          { startupName: { $regex: req.query.search, $options: "i" } },
        ];
      }

      if (req.query.workType) {
        query.workType = req.query.workType;
      }
      if (req.query.commitment) {
        query.commitment = req.query.commitment;
      }

      // company related query
      if (req.query.startupId) {
        query.startupId = req.query.startupId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }

      // pagination related work
      if (req.query.page) {
        const page = req.query.page;
        const perPage = req.query.perPage || 12;
        const skipItems = (page - 1) * perPage;

        const total = await opportunitiesCollection.countDocuments(query);
        const cursor = opportunitiesCollection
          .find(query)
          .skip(skipItems)
          .limit(perPage);
        const opportunities = await cursor.toArray();
        return res.send({ total, opportunities });
      }

      const cursor = opportunitiesCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/open/opportunities", async (req, res) => {
      const query = { status: "active" };
      const cursor = opportunitiesCollection
        .find(query)
        .limit(3)
        .sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/manage/opportunities", async (req, res) => {
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

    app.get("/api/my/opportunities", async (req, res) => {
      const query = {};
      if (req.query.founderId) {
        query.founderId = req.query.founderId;
      }
      const result = await opportunitiesCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/api/opportunities/:id", async (req, res) => {
      const id = req.params.id;
      if (id.length !== 24) {
        return res.json({ ok: false });
      }
      const query = { _id: new ObjectId(id) };
      const result = await opportunitiesCollection.findOne(query);
      if (!result) {
        return res.json({ ok: false });
      }
      res.json(result);
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
    });

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
        ...startup,
        createdAt: new Date(),
      };
      const result = await startupCollection.insertOne(newStartup);
      res.send(result);
    });

    app.patch("/api/startup/:id", async (req, res) => {
      const { id } = req.params;
      const updatedStartup = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedStartup,
      };
      const result = await startupCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //application related Api
    app.get("/api/applications", async (req, res) => {
      const query = {};
      if (req.query.opportunityId) {
        query.opportunityId = req.query.opportunityId;
      }
      if (req.query.applicantId) {
        query.applicantId = req.query.applicantId;
      }
      if (req.query.founderId) {
        query.founderId = req.query.founderId;
      }
      const result = await applicationCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/api/applications", async (req, res) => {
      const application = req.body;
      const newApplication = {
        ...application,
        applied_at: new Date(),
      };
      const result = await applicationCollection.insertOne(newApplication);
      res.send(result);
    });

    app.patch("/api/applications/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedApplication = req.body;
        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            Status: updatedApplication.status, 
          },
        };

        const result = await applicationCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update application" });
      }
    });

    // plans related Api
    app.get("/api/plans", async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.id = req.query.plan_id;
      }
      const plan = await plansCollection.findOne(query);
      res.send(plan);
    });

    //payment related Api
    app.post("/api/payment", async (req, res) => {
      const payment = req.body;
      const newPayment = {
        ...payment,
        createdAt: new Date(),
      };
      const result = await paymentCollection.insertOne(newPayment);

      const filter = { email: payment.email };
      const updateDoc = {
        $set: {
          plan: payment.planId,
        },
      };
      const updatedResult = await userCollection.updateOne(filter, updateDoc);
      res.send(updatedResult);
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
