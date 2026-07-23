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
    const sessionCollection = database.collection("session");

    const verifyToken = async (req, res, next) => {
      const authHeader = req.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const query = { token: token };
      const session = await sessionCollection.findOne(query);
      if (!session) {
        return res.status(401).send({ message: "Unauthorized access" });
      }
      const userId = session.userId;
      const userQuery = { _id: userId };
      const user = await userCollection.findOne(userQuery);
      if (!user) {
        return res.status(401).send({ message: "Unauthorized access" });
      }

      req.user = user;
      next();
    };

    const verifyContributor = async (req, res, next) => {
      if (req.user?.role !== "contributor") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    const verifyAdmin = async (req, res, next) => {
      if (req.user?.role !== "admin") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    const verifyFounder = async (req, res, next) => {
      if (req.user?.role !== "founder") {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };
    const verifyFounderOrAdmin = (req, res, next) => {
      const role = req.user?.role;
      if (role === "founder" || role === "admin") {
        return next();
      }
      return res.status(403).send({
        message: "Forbidden: Access restricted to Founders or Admins only",
      });
    };
    const verifyContributorOrFounder = (req, res, next) => {
      const role = req.user?.role;
      if (role === "contributor" || role === "founder") {
        return next();
      }
      return res.status(403).send({
        message: "Forbidden: Access restricted to Founders or Admins only",
      });
    };

    // user related Api
    app.get("/api/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/api/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const updatedUser = req.body;

      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: updatedUser,
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    //opportunities related Api
    app.get("/api/opportunities", async (req, res) => {
      // console.log("server side q", req.query);
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

    // app.get("/api/manage/opportunities", async (req, res) => {
    //   const query = {};
    //   if (req.query.startupId) {
    //     query.startupId = req.query.startupId;
    //   }
    //   if (req.query.status) {
    //     query.status = req.query.status;
    //   }
    //   const result = await opportunitiesCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.get(
      "/api/my/opportunities",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        const query = {};
        if (req.query.founderId) {
          query.founderId = req.query.founderId;
          if (req.user._id.toString() !== req.query.founderId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const result = await opportunitiesCollection.find(query).toArray();
        res.send(result);
      },
    );

    app.get("/api/opportunities/:id", verifyToken, async (req, res) => {
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

    app.post(
      "/api/opportunities",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        const opportunity = req.body;
        const result = await opportunitiesCollection.insertOne(opportunity);
        res.send(result);
      },
    );

    app.patch(
      "/api/opportunities/:id",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        const { id } = req.params;
        const updatedOpportunity = req.body;

        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedOpportunity,
        };
        const result = await opportunitiesCollection.updateOne(
          query,
          updateDoc,
        );
        res.send(result);
      },
    );

    app.delete(
      "/api/opportunities/:id",
      verifyToken,
      verifyFounderOrAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await opportunitiesCollection.deleteOne(query);
        res.send(result);
      },
    );

    //startup related Api
    app.get("/api/startups", async (req, res) => {
      // console.log("server side q", req.query);
      const query = {};
      if (req.query.search) {
        query.$or = [
          { name: { $regex: req.query.search, $options: "i" } },
          { industry: { $regex: req.query.search, $options: "i" } },
        ];
      }
      // pagination related work
      if (req.query.page) {
        const page = req.query.page;
        const perPage = req.query.perPage || 12;
        const skipItems = (page - 1) * perPage;

        const newQuery = { ...query, status: "approved" };

        const total = await startupCollection.countDocuments(newQuery);
        const cursor = startupCollection
          .find(newQuery)
          .skip(skipItems)
          .limit(perPage);
        const startups = await cursor.toArray();
        return res.send({ total, startups });
      }

      const cursor = startupCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/startups/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      if (id.length !== 24) {
        return res.json({ ok: false });
      }
      const query = { _id: new ObjectId(id) };
      const result = await startupCollection.findOne(query);
      if (!result) {
        return res.json({ ok: false });
      }
      res.json(result);
    });

    app.get("/api/featured/startups", async (req, res) => {
      const result = await startupCollection.find().limit(3).toArray();
      res.send(result);
    });

    app.get("/api/my/startup", verifyToken, verifyFounder, async (req, res) => {
      const query = {};
      if (req.query.founderId) {
        query.founderId = req.query.founderId;
        if (req.user._id.toString() !== req.query.founderId) {
          return res.status(403).send({ message: "forbidden access" });
        }
      }
      const result = await startupCollection.findOne(query);

      res.send(result || {});
    });

    app.post("/api/startup", verifyToken, verifyFounder, async (req, res) => {
      const startup = req.body;
      const newStartup = {
        ...startup,
        createdAt: new Date(),
      };
      const result = await startupCollection.insertOne(newStartup);
      res.send(result);
    });

    app.patch(
      "/api/startup/:id",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        const { id } = req.params;
        const updatedStartup = req.body;

        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: updatedStartup,
        };
        const result = await startupCollection.updateOne(query, updateDoc);
        res.send(result);
      },
    );

    app.patch(
      "/api/startup/status/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const updatedStatus = req.body;

        const query = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: updatedStatus.status,
          },
        };
        const result = await startupCollection.updateOne(query, updateDoc);
        res.send(result);
      },
    );

    //application related Api
    app.get(
      "/api/applications",
      verifyToken,
      verifyContributorOrFounder,
      async (req, res) => {
        const query = {};
        if (req.query.opportunityId) {
          query.opportunityId = req.query.opportunityId;
        }
        if (req.query.applicantId) {
          query.applicantId = req.query.applicantId;
          if (req.user._id.toString() !== req.query.applicantId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }

        if (req.query.founderId) {
          query.founderId = req.query.founderId;
          if (req.user._id.toString() !== req.query.founderId) {
            return res.status(403).send({ message: "forbidden access" });
          }
        }
        const result = await applicationCollection.find(query).toArray();
        res.send(result);
      },
    );

    app.post(
      "/api/applications",
      verifyToken,
      verifyContributor,
      async (req, res) => {
        const application = req.body;
        const newApplication = {
          ...application,
          applied_at: new Date(),
        };
        const result = await applicationCollection.insertOne(newApplication);
        res.send(result);
      },
    );

    app.patch(
      "/api/applications/:id",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        try {
          const id = req.params.id;
          const updatedApplication = req.body;
          const filter = { _id: new ObjectId(id) };

          const updateDoc = {
            $set: {
              Status: updatedApplication.status,
            },
          };

          const result = await applicationCollection.updateOne(
            filter,
            updateDoc,
          );
          res.send(result);
        } catch (error) {
          res.status(500).send({ error: "Failed to update application" });
        }
      },
    );

    // plans related Api
    app.get("/api/plans", verifyToken, async (req, res) => {
      const query = {};
      if (req.query.plan_id) {
        query.id = req.query.plan_id;
      }
      const plan = await plansCollection.findOne(query);
      res.send(plan);
    });

    //payment related Api
    app.get("/api/payment", verifyToken, verifyAdmin, async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });
    app.post("/api/payment", verifyToken, verifyFounder, async (req, res) => {
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

    //aggregation related Api

    const getDateRanges = () => {
      const now = new Date();
      const startOfCurrentMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );
      const startOfPreviousMonth = new Date(
        now.getFullYear(),
        now.getMonth() - 1,
        1,
      );
      const endOfPreviousMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        0,
        23,
        59,
        59,
        999,
      );

      return { startOfCurrentMonth, startOfPreviousMonth, endOfPreviousMonth };
    };

    app.get(
      "/api/stats/founder",
      verifyToken,
      verifyFounder,
      async (req, res) => {
        try {
          const queryUserId = req.query.userId;
          // Extract authenticated user ID attached by verifyToken
          const authUserId = (req.user?._id || req.user?.id || "").toString();

          // 1. Ensure parameters exist
          if (!queryUserId) {
            return res
              .status(400)
              .json({ error: "Missing required 'userId' query parameter" });
          }

          if (!authUserId) {
            return res.status(401).json({ message: "Unauthorized access" });
          }

          // 2. Security Check: Founder can ONLY fetch their own stats (Fixed .toString capitalization)
          if (queryUserId.toString() !== authUserId) {
            return res.status(403).json({ message: "Forbidden access" });
          }

          const {
            startOfCurrentMonth,
            startOfPreviousMonth,
            endOfPreviousMonth,
          } = getDateRanges();

          // 3. Validate MongoDB ObjectId format
          let userObjId;
          try {
            userObjId = new ObjectId(queryUserId);
          } catch (err) {
            return res.status(400).json({ error: "Invalid userId format" });
          }

          // Fetch user and plan details
          const user = await userCollection.findOne({ _id: userObjId });
          const planDetails = await plansCollection.findOne({
            id: user?.plan || "founder_free",
          });

          // Match either String or ObjectId founderId in database
          const founderMatchCondition = {
            $or: [{ founderId: String(queryUserId) }, { founderId: userObjId }],
          };

          // Run parallel aggregation queries
          const [opportunityStats, applicationStats] = await Promise.all([
            opportunitiesCollection
              .aggregate([
                { $match: founderMatchCondition },
                {
                  $group: {
                    _id: null,
                    totalOpportunities: { $sum: 1 },
                    activeOpportunities: {
                      $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
                    },
                  },
                },
              ])
              .toArray(),

            applicationCollection
              .aggregate([
                { $match: founderMatchCondition },
                {
                  $group: {
                    _id: null,
                    totalApplications: { $sum: 1 },
                    acceptedApplications: {
                      $sum: {
                        $cond: [
                          {
                            $in: [
                              { $toLower: { $ifNull: ["$Status", "$status"] } },
                              ["accepted", "approved"],
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    rejectedApplications: {
                      $sum: {
                        $cond: [
                          {
                            $in: [
                              { $toLower: { $ifNull: ["$Status", "$status"] } },
                              ["rejected", "declined"],
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    pendingApplications: {
                      $sum: {
                        $cond: [
                          {
                            $in: [
                              { $toLower: { $ifNull: ["$Status", "$status"] } },
                              ["pending", "submitted"],
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    applicationsThisMonth: {
                      $sum: {
                        $cond: [
                          {
                            $gte: [
                              {
                                $toDate: {
                                  $ifNull: ["$applied_at", "$appliedAt"],
                                },
                              },
                              startOfCurrentMonth,
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                    applicationsPreviousMonth: {
                      $sum: {
                        $cond: [
                          {
                            $and: [
                              {
                                $gte: [
                                  {
                                    $toDate: {
                                      $ifNull: ["$applied_at", "$appliedAt"],
                                    },
                                  },
                                  startOfPreviousMonth,
                                ],
                              },
                              {
                                $lte: [
                                  {
                                    $toDate: {
                                      $ifNull: ["$applied_at", "$appliedAt"],
                                    },
                                  },
                                  endOfPreviousMonth,
                                ],
                              },
                            ],
                          },
                          1,
                          0,
                        ],
                      },
                    },
                  },
                },
              ])
              .toArray(),
          ]);

          const opps = opportunityStats[0] || {
            totalOpportunities: 0,
            activeOpportunities: 0,
          };
          const apps = applicationStats[0] || {
            totalApplications: 0,
            acceptedApplications: 0,
            rejectedApplications: 0,
            pendingApplications: 0,
            applicationsThisMonth: 0,
            applicationsPreviousMonth: 0,
          };

          const maxAllowed = planDetails?.maxOpportunities || 3;

          return res.status(200).json({
            success: true,
            role: "founder",
            stats: {
              totalOpportunities: opps.totalOpportunities,
              activeOpportunities: opps.activeOpportunities,
              totalApplications: apps.totalApplications,
              acceptedApplications: apps.acceptedApplications,
              rejectedApplications: apps.rejectedApplications,
              pendingApplications: apps.pendingApplications,
              applicationsThisMonth: apps.applicationsThisMonth,
              applicationsPreviousMonth: apps.applicationsPreviousMonth,
              plan: user?.plan || "founder_free",
              maxOpportunities: maxAllowed,
              remainingOpportunities: Math.max(
                0,
                maxAllowed - opps.totalOpportunities,
              ),
            },
          });
        } catch (error) {
          console.error("Error generating founder metrics:", error);
          return res
            .status(500)
            .json({ error: "Internal Server Error", details: error.message });
        }
      },
    );

    app.get("/api/stats/contributor", verifyToken, verifyContributor, async (req, res) => {
      try {
        const queryUserId = req.query.userId;

        const rawAuthId = req.user?._id || req.user?.id || req.user?.userId || req.user?.sub;
        const authUserId = rawAuthId ? rawAuthId.toString() : "";
        const email = req.user?.email;

        if (!queryUserId) {
          return res
            .status(400)
            .json({ error: "Missing required 'userId' query parameter" });
        }

        if (!authUserId) {
          console.error(
            "verifyToken attached user object but missing ID:",
            req.user,
          );
          return res
            .status(401)
            .json({ message: "Unauthorized access: Invalid token payload" });
        }

        if (queryUserId.toString() !== authUserId) {
          return res.status(403).json({ message: "Forbidden access" });
        }

        const {
          startOfCurrentMonth,
          startOfPreviousMonth,
          endOfPreviousMonth,
        } = getDateRanges();

        // 4. Construct match criteria safely
        const matchCriteria = [];

        if (authUserId) {
          matchCriteria.push({ applicantId: authUserId });

          // Also match as ObjectId if stored natively in Mongo
          if (ObjectId.isValid(authUserId)) {
            matchCriteria.push({ applicantId: new ObjectId(authUserId) });
          }
        }

        if (email) {
          matchCriteria.push({ Applicant_email: email });
          matchCriteria.push({ applicant_email: email });
        }

        if (matchCriteria.length === 0) {
          return res
            .status(400)
            .json({ error: "User identity missing from token" });
        }

        // 5. Run Aggregation Pipeline
        const applicantStats = await applicationCollection
          .aggregate([
            { $match: { $or: matchCriteria } },
            {
              $group: {
                _id: null,
                totalApplied: { $sum: 1 },
                accepted: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $toLower: { $ifNull: ["$status", "$Status"] } },
                          ["accepted", "approved"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                rejected: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $toLower: { $ifNull: ["$status", "$Status"] } },
                          ["rejected", "declined"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                pending: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $toLower: { $ifNull: ["$status", "$Status"] } },
                          ["pending", "submitted"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                totalApplicationInThisMonth: {
                  $sum: {
                    $cond: [
                      {
                        $gte: [
                          {
                            $toDate: { $ifNull: ["$applied_at", "$appliedAt"] },
                          },
                          startOfCurrentMonth,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                totalApplicationProviousMonth: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          {
                            $gte: [
                              {
                                $toDate: {
                                  $ifNull: ["$applied_at", "$appliedAt"],
                                },
                              },
                              startOfPreviousMonth,
                            ],
                          },
                          {
                            $lte: [
                              {
                                $toDate: {
                                  $ifNull: ["$applied_at", "$appliedAt"],
                                },
                              },
                              endOfPreviousMonth,
                            ],
                          },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                totalApplicationOtherMonth: {
                  $sum: {
                    $cond: [
                      {
                        $lt: [
                          {
                            $toDate: { $ifNull: ["$applied_at", "$appliedAt"] },
                          },
                          startOfPreviousMonth,
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
            {
              $project: {
                _id: 0,
                totalApplied: 1,
                accepted: 1,
                rejected: 1,
                pending: 1,
                totalApplicationInThisMonth: 1,
                totalApplicationProviousMonth: 1,
                totalApplicationOtherMonth: 1,
              },
            },
          ])
          .toArray();

        const stats = applicantStats[0] || {
          totalApplied: 0,
          accepted: 0,
          rejected: 0,
          pending: 0,
          totalApplicationInThisMonth: 0,
          totalApplicationProviousMonth: 0,
          totalApplicationOtherMonth: 0,
        };

        return res
          .status(200)
          .json({ success: true, role: "contributor", stats });
      } catch (error) {
        console.error("Error generating contributor metrics:", error);
        return res
          .status(500)
          .json({ error: "Internal Server Error", details: error.message });
      }
    });

    app.get("/api/stats/admin", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const {
          startOfCurrentMonth,
          startOfPreviousMonth,
          endOfPreviousMonth,
        } = getDateRanges();

        const [
          totalUsers,
          totalStartups,
          totalOpportunities,
          totalApplications,
          userRegistrationData,
          revenueData,
        ] = await Promise.all([
          userCollection.countDocuments(),
          startupCollection.countDocuments({ status: "approved" }),
          opportunitiesCollection.countDocuments({ status: "active" }),
          applicationCollection.countDocuments(),

          userCollection
            .aggregate([
              {
                $group: {
                  _id: null,
                  registeredThisMonth: {
                    $sum: {
                      $cond: [
                        {
                          $gte: [
                            { $toDate: "$createdAt" },
                            startOfCurrentMonth,
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  registeredPreviousMonth: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {
                              $gte: [
                                { $toDate: "$createdAt" },
                                startOfPreviousMonth,
                              ],
                            },
                            {
                              $lte: [
                                { $toDate: "$createdAt" },
                                endOfPreviousMonth,
                              ],
                            },
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                },
              },
            ])
            .toArray(),

          paymentCollection
            .aggregate([
              {
                $group: {
                  _id: null,
                  totalRevenue: { $sum: "$price" },
                  revenueThisMonth: {
                    $sum: {
                      $cond: [
                        {
                          $gte: [
                            { $toDate: "$createdAt" },
                            startOfCurrentMonth,
                          ],
                        },
                        "$price",
                        0,
                      ],
                    },
                  },
                  revenuePreviousMonth: {
                    $sum: {
                      $cond: [
                        {
                          $and: [
                            {
                              $gte: [
                                { $toDate: "$createdAt" },
                                startOfPreviousMonth,
                              ],
                            },
                            {
                              $lte: [
                                { $toDate: "$createdAt" },
                                endOfPreviousMonth,
                              ],
                            },
                          ],
                        },
                        "$price",
                        0,
                      ],
                    },
                  },
                },
              },
            ])
            .toArray(),
        ]);

        const usersMeta = userRegistrationData[0] || {
          registeredThisMonth: 0,
          registeredPreviousMonth: 0,
        };
        const revMeta = revenueData[0] || {
          totalRevenue: 0,
          revenueThisMonth: 0,
          revenuePreviousMonth: 0,
        };

        return res.status(200).json({
          success: true,
          role: "admin",
          stats: {
            totalUsers,
            registeredUsersThisMonth: usersMeta.registeredThisMonth,
            registeredUsersPreviousMonth: usersMeta.registeredPreviousMonth,
            totalStartups,
            totalOpportunities,
            totalApplications,
            totalRevenue: revMeta.totalRevenue,
            revenueThisMonth: revMeta.revenueThisMonth,
            revenuePreviousMonth: revMeta.revenuePreviousMonth,
          },
        });
      } catch (error) {
        console.error("Error generating admin metrics:", error);
        return res
          .status(500)
          .json({ error: "Internal Server Error", details: error.message });
      }
    });

    app.get("/api/stats/public", async (req, res) => {
      try {
        // 1. Fetch Startup Statistics
        const startupStats = await startupCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalStartups: { $sum: 1 },
                activeStartups: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $toLower: { $ifNull: ["$status", ""] } },
                          ["approved", "active"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .toArray();

        // 2. Fetch Application Statistics
        const applicationStats = await applicationCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalApplications: { $sum: 1 },
                acceptedApplications: {
                  $sum: {
                    $cond: [
                      {
                        $in: [
                          { $toLower: { $ifNull: ["$status", "$Status"] } },
                          ["accepted", "approved"],
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .toArray();

        // 3. Fetch Opportunity Statistics
        const opportunityStats = await opportunitiesCollection
          .aggregate([
            {
              $group: {
                _id: null,
                totalOpportunities: { $sum: 1 },
                activeOpportunities: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          { $toLower: { $ifNull: ["$status", ""] } },
                          "active",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ])
          .toArray();

        // 4. Fetch Total Revenue / Funding Raised from Payment Collection
        const paymentStats = await paymentCollection
          .aggregate([
            {
              $group: {
                _id: null,
                // Adjust "$price" if your field name is different (e.g., "$amount")
                totalFundingRaised: { $sum: { $ifNull: ["$price", 0] } },
              },
            },
          ])
          .toArray();

        // Extract aggregated results or fall back to 0 if collections are empty
        const startupData = startupStats[0] || {
          totalStartups: 0,
          activeStartups: 0,
        };
        const appData = applicationStats[0] || {
          totalApplications: 0,
          acceptedApplications: 0,
        };
        const oppData = opportunityStats[0] || {
          totalOpportunities: 0,
          activeOpportunities: 0,
        };
        const payData = paymentStats[0] || { totalFundingRaised: 0 };

        // Construct the public response object
        return res.status(200).json({
          success: true,
          stats: {
            totalStartups: startupData.totalStartups,
            activeStartups: startupData.activeStartups,
            totalApplications: appData.totalApplications,
            totalAcceptedApplications: appData.acceptedApplications,
            totalOpportunities: oppData.totalOpportunities,
            activeOpportunities: oppData.activeOpportunities,
            totalFundingRaised: payData.totalFundingRaised,
          },
        });
      } catch (error) {
        console.error("Error fetching public stats:", error);
        return res.status(500).json({
          success: false,
          error: "Failed to retrieve public statistics",
          details: error.message,
        });
      }
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
