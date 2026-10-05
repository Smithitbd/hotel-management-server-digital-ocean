require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const nodemailer = require("nodemailer");

dotenv.config();

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8",
);
const serviceAccount = JSON.parse(decoded);

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();

// =========================================================
// EMAIL TRANSPORTER (Nodemailer)
// =========================================================
// const transporter = nodemailer.createTransport({
//   service: "gmail",
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASSWORD, // Gmail App Password
//   },
// });

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "security@smithit.com.bd", // full email
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

const app = express();
const port = process.env.PORT || 3000;

// app.use(cors());
app.use(
  cors({
    origin: [
      "https://smithit.obokash.site",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(express.json());
app.use(fileUpload());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vacfvah.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("Hotel_Management_Software");

    const employeeCollection = db.collection("Employees");
    const roomCollection = db.collection("Rooms");
    const maintenanceHistoryCollection = db.collection("Maintenance History");
    const roomVariantCollection = db.collection("Room Variants");
    const checkInCollection = db.collection("CheckInList");
    const checkOutCollection = db.collection("Checkout List");
    const bannedGuestCollection = db.collection("Banned Guests");
    const foodMenuCollection = db.collection("Food Menu");
    const roomServiceCollection = db.collection("Room Services");
    const transportServiceCollection = db.collection("Transport Services");
    const laundryServiceCollection = db.collection("Laundry Services");
    const restaurantOrderCollection = db.collection("Restaurant Orders");
    const reservationCollection = db.collection("Reservations");
    const salaryStructureCollection = db.collection("Salary Structures");
    const payrollCollection = db.collection("Payrolls");
    const hotelCollection = db.collection("Hotels");
    const expenseCategoryCollection = db.collection("Expense Categories");
    const expenseEntryCollection = db.collection("Expense Entries");
    const usersCollection = db.collection("Users");

    // =========================================================
    // JWT
    // =========================================================
    app.post("/jwt", async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });

      res.send({ token });
    });

    // =========================================================
    // FORGOT PASSWORD (custom email with frontend reset link)
    // =========================================================
    // app.post("/forgot-password", async (req, res) => {
    //   try {
    //     const { email } = req.body;

    //     if (!email) {
    //       return res.status(400).send({ message: "Email is required" });
    //     }

    //     // Check if user exists in Firebase
    //     try {
    //       await auth.getUserByEmail(email);
    //     } catch (error) {
    //       // Don't reveal whether the email exists
    //       return res.status(200).send({
    //         message:
    //           "If this email exists, a password reset link has been sent.",
    //       });
    //     }

    //     // Generate Firebase password reset link
    //     const actionCodeSettings = {
    //       url: "https://smithit.obokash.site/reset-password",
    //       handleCodeInApp: true,
    //     };

    //     const resetLink = await auth.generatePasswordResetLink(
    //       email,
    //       actionCodeSettings,
    //     );

    //     console.log("Full Firebase Reset Link:", resetLink);

    //     // Extract oobCode from the Firebase link
    //     const url = new URL(resetLink);
    //     const oobCode = url.searchParams.get("oobCode");

    //     console.log("Extracted oobCode:", oobCode);

    //     if (!oobCode) {
    //       return res
    //         .status(500)
    //         .send({ message: "Failed to generate reset code" });
    //     }

    //     // Custom frontend link
    //     const frontendResetLink = `https://smithit.obokash.site/reset-password?oobCode=${oobCode}`;

    //     console.log("Frontend Link:", frontendResetLink);

    //     // Send email
    //     const mailOptions = {
    //       from: `"Obokash Hotel Management Software" <${process.env.EMAIL_USER}>`,
    //       to: email,
    //       subject: "Reset Your Password",
    //       html: `
    //         <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    //           <h2>Password Reset Request</h2>
    //           <p>Hello,</p>
    //           <p>We received a request to reset the password for your account.</p>
    //           <p>Click the button below to reset your password:</p>
    //           <a href="${frontendResetLink}" 
    //             style="display: inline-block; padding: 12px 24px; background-color: #0d9488; 
    //                     color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
    //             Reset Password
    //           </a>
    //           <p>Or copy and paste this link into your browser:</p>
    //           <p style="word-break: break-all; color: #0d9488;">${frontendResetLink}</p>
    //           <p>This link will expire in 1 hour.</p>
    //           <p>If you didn't request this, you can safely ignore this email.</p>
    //           <br/>
    //           <p style="color: #666; font-size: 13px;">— Obokash Hotel Management Software</p>
    //         </div>
    //       `,
    //     };

    //     await transporter.sendMail(mailOptions);

    //     res.status(200).send({
    //       message: "If this email exists, a password reset link has been sent.",
    //     });
    //   } catch (error) {
    //     console.error("Forgot password error:", error);
    //     res
    //       .status(500)
    //       .send({ message: "Failed to process password reset request" });
    //   }
    // });

        // =========================================================
    // FORGOT PASSWORD (custom email with frontend reset link)
    // =========================================================
    app.post("/forgot-password", async (req, res) => {
      try {
        const { email } = req.body;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        try {
          await auth.getUserByEmail(email);
        } catch (error) {
          return res.status(200).send({
            message:
              "If this email exists, a password reset link has been sent.",
          });
        }

        // No actionCodeSettings → avoids UNAUTHORIZED_DOMAIN
        const resetLink = await auth.generatePasswordResetLink(email);

        console.log("Full Firebase Reset Link:", resetLink);

        const oobCode = new URL(resetLink).searchParams.get("oobCode");
        console.log("Extracted oobCode:", oobCode);

        if (!oobCode) {
          return res
            .status(500)
            .send({ message: "Failed to generate reset code" });
        }

        const frontendResetLink = `https://smithit.obokash.site/reset-password?oobCode=${oobCode}`;
        console.log("Frontend Link:", frontendResetLink);

        await transporter.sendMail({
          from: `"Obokash Hotel Management Software" <security@smithit.com.bd>`,
          to: email,
          subject: "Reset Your Password",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Password Reset Request</h2>
              <p>Hello,</p>
              <p>We received a request to reset the password for your account.</p>
              <p>Click the button below to reset your password:</p>
              <a href="${frontendResetLink}"
                style="display: inline-block; padding: 12px 24px; background-color: #0d9488;
                        color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
                Reset Password
              </a>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #0d9488;">${frontendResetLink}</p>
              <p>This link will expire in 1 hour.</p>
              <p>If you didn't request this, you can safely ignore this email.</p>
              <br/>
              <p style="color: #666; font-size: 13px;">— Obokash Hotel Management Software</p>
            </div>
          `,
        });

        res.status(200).send({
          message:
            "If this email exists, a password reset link has been sent.",
        });
      } catch (error) {
        console.error("Forgot password error:", error.code, error.message);
        res.status(500).send({
          message: "Failed to process password reset request",
          code: error.code || null,
          error: error.message,
        });
      }
    });

    const verifyToken = (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: "404 Not Found" });
        // return res.status(401).send({ message: "Unauthorized access" });
      }

      const token = authHeader.split(" ")[1];

      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).send({ message: "Forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // Dashboard: status === "Admin" → Settings only (hotel list / approve / delete)
    const verifyAdmin = async (req, res, next) => {
      try {
        const hotel = await hotelCollection.findOne({
          email: req.decoded.email,
        });

        if (!hotel || hotel.status !== "Admin") {
          return res.status(403).send({ message: "Forbidden: Admin only" });
        }

        req.userType = "admin";
        req.hotelEmail = hotel.email;
        next();
      } catch (error) {
        res.status(500).send({ message: "Failed to verify admin" });
      }
    };

    // Dashboard: status === "Approved"
    // owner + sub-user → Dashboard, Rooms, Services, Billing,
    // Check In & Out, Guests, Reservations, Settings
    const verifyHotelUser = async (req, res, next) => {
      try {
        const email = req.decoded.email;

        const hotel = await hotelCollection.findOne({ email });
        if (hotel && hotel.status === "Approved") {
          req.userType = "owner";
          req.hotelEmail = hotel.email;
          return next();
        }

        const subUser = await usersCollection.findOne({
          $or: [{ email1: email }, { email2: email }],
        });

        if (subUser && subUser.status === "Approved") {
          req.userType = "sub-user";
          req.hotelEmail = subUser.hotelEmail;
          return next();
        }

        return res
          .status(403)
          .send({ message: "Forbidden: Approved hotel user only" });
      } catch (error) {
        res.status(500).send({ message: "Failed to verify user" });
      }
    };

    // Dashboard: status === "Approved" && type !== "sub-user"
    // Employees + Reports
    // Also owner settings mutations (logo / hotel patch)
    // Admin can use the same routes from Settings
    const verifyOwnerOrAdmin = async (req, res, next) => {
      try {
        const hotel = await hotelCollection.findOne({
          email: req.decoded.email,
        });

        if (hotel && hotel.status === "Approved") {
          req.userType = "owner";
          req.hotelEmail = hotel.email;
          return next();
        }

        if (hotel && hotel.status === "Admin") {
          req.userType = "admin";
          req.hotelEmail = hotel.email;
          return next();
        }

        return res
          .status(403)
          .send({ message: "Forbidden: Owner or admin only" });
      } catch (error) {
        res.status(500).send({ message: "Failed to verify owner or admin" });
      }
    };

    const assertSameHotel = (req, res, hotelEmail) => {
      if (hotelEmail && req.hotelEmail && hotelEmail !== req.hotelEmail) {
        res.status(403).send({ message: "Forbidden access" });
        return false;
      }
      return true;
    };

    // =========================================================
    // ROOT
    // =========================================================
    app.get("/", (req, res) => {
      res.send("Hotel Software Server is Running 🚀");
    });

    // =========================================================
    // USER STATUS (token required, own email or admin)
    // =========================================================
    app.get("/users/:email/status", verifyToken, async (req, res) => {
      try {
        const email = req.params.email;

        if (req.decoded.email !== email) {
          const requesterHotel = await hotelCollection.findOne({
            email: req.decoded.email,
          });
          if (requesterHotel?.status !== "Admin") {
            return res.status(403).send({ message: "Forbidden access" });
          }
        }

        const hotel = await hotelCollection.findOne(
          { email },
          { projection: { status: 1, email: 1, hotelName: 1 } },
        );

        if (hotel) {
          return res.send({
            status: hotel.status,
            type: hotel.status === "Admin" ? "admin" : "owner",
            hotelEmail: hotel.email,
            hotelName: hotel.hotelName || null,
          });
        }

        const subUser = await usersCollection.findOne({
          $or: [{ email1: email }, { email2: email }],
        });

        if (subUser) {
          return res.send({
            status: subUser.status,
            type: "sub-user",
            hotelEmail: subUser.hotelEmail,
            hotelName: subUser.hotelName,
          });
        }

        return res.status(404).send({ status: "Pending" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get status" });
      }
    });

    // =========================================================
    // DASHBOARD STATS — Approved + Admin + sub-user
    // =========================================================
    app.get(
      "/dashboard/stats",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const currentGuests = await checkInCollection.countDocuments({
          hotelEmail,
          status: { $ne: "Checked Out" },
        });

        const currentEmployees = await employeeCollection.countDocuments({
          hotelEmail,
          EmploymentStatus: { $in: ["Active", "On Leave"] },
        });

        const totalAvailableRooms = await roomCollection.countDocuments({
          hotelEmail,
          roomStatus: "Available",
        });

        const totalOccupiedRooms = await roomCollection.countDocuments({
          hotelEmail,
          roomStatus: "Occupied",
        });

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59,
        );

        const thisMonthCheckouts = await checkOutCollection
          .find({
            hotelEmail,
            checkedOutAt: {
              $gte: startOfMonth,
              $lte: endOfMonth,
            },
          })
          .toArray();

        const currentMonthEarning = thisMonthCheckouts.reduce((sum, item) => {
          return sum + (Number(item.totalCharges) || 0);
        }, 0);

        res.send({
          currentGuests,
          currentEmployees,
          totalAvailableRooms,
          totalOccupiedRooms,
          currentMonthEarning,
        });
      },
    );

    app.get(
      "/dashboard/customers-per-month",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const checkouts = await checkOutCollection
          .find({ hotelEmail })
          .toArray();

        const monthlyCount = {};

        checkouts.forEach((item) => {
          const date = new Date(item.checkedOutAt || item.createdAt);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          monthlyCount[key] = (monthlyCount[key] || 0) + 1;
        });

        const sortedKeys = Object.keys(monthlyCount).sort();

        const categories = sortedKeys.map((key) => {
          const [year, month] = key.split("-");
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          return `${monthNames[parseInt(month) - 1]} ${year}`;
        });

        const seriesData = sortedKeys.map((key) => monthlyCount[key]);

        res.send({
          categories,
          series: [{ name: "Customers", data: seriesData }],
        });
      },
    );

    app.get(
      "/dashboard/revenue-by-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const checkouts = await checkOutCollection
          .find({ hotelEmail })
          .toArray();

        let restaurantRevenue = 0;
        let laundryRevenue = 0;
        let transportRevenue = 0;
        let roomRevenue = 0;

        checkouts.forEach((item) => {
          roomRevenue += Number(item.actualRoomCharge || item.totalAmount || 0);

          (item.restaurantOrders || []).forEach((order) => {
            restaurantRevenue += Number(order.totalAmount || 0);
          });

          (item.laundryOrders || []).forEach((order) => {
            laundryRevenue += Number(order.totalCost || 0);
          });

          (item.transportOrders || []).forEach((order) => {
            transportRevenue += Number(order.fare || 0);
          });
        });

        res.send({
          labels: ["Room", "Restaurant", "Laundry", "Transport"],
          series: [
            roomRevenue,
            restaurantRevenue,
            laundryRevenue,
            transportRevenue,
          ],
        });
      },
    );

    // =========================================================
    // EMPLOYEES — owner / admin only (hidden from sub-user)
    // =========================================================
    app.post(
      "/employees",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          if (!req.files || !req.files.image) {
            return res
              .status(400)
              .json({ message: "Profile photo is required" });
          }

          const image = req.files.image;

          if (!image.mimetype.startsWith("image/")) {
            return res
              .status(400)
              .json({ message: "Only image files are allowed" });
          }

          const uploadDir = path.join(__dirname, "uploads", "employees");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(image.name);

          await image.mv(path.join(uploadDir, uniqueName));

          const employee = {
            FullName: req.body.FullName,
            EmployeeID: req.body.EmployeeID,
            Email: req.body.Email,
            Phone: req.body.Phone,
            NID: req.body.NID,
            Gender: req.body.Gender,
            Department: req.body.Department,
            Designation: req.body.Designation,
            JoiningDate: req.body.JoiningDate,
            EmploymentStatus: req.body.EmploymentStatus,
            Address: req.body.Address,
            Image: `/uploads/employees/${uniqueName}`,
            createdAt: new Date(),
            hotelEmail: req.body.hotelEmail || req.hotelEmail,
          };

          const result = await employeeCollection.insertOne(employee);
          res.status(201).send(result);
        } catch (error) {
          console.error("Add employee error:", error);
          res.status(500).send({ message: "Failed to add employee" });
        }
      },
    );

    app.get(
      "/employees/active",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const employees = await employeeCollection
          .find({
            hotelEmail,
            EmploymentStatus: { $in: ["Active", "On Leave"] },
          })
          .toArray();
        res.send(employees);
      },
    );

    app.get(
      "/employees/inactive",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const employees = await employeeCollection
          .find({
            hotelEmail,
            EmploymentStatus: { $in: ["Resigned", "Terminated"] },
          })
          .toArray();
        res.send(employees);
      },
    );

    app.get(
      "/employees/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid employee ID" });
        }
        const employee = await employeeCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(employee);
      },
    );

    app.patch(
      "/employees/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { id } = req.params;
        const { _id, ...updatedData } = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid employee ID" });
        }
        const result = await employeeCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData },
        );
        res.send(result);
      },
    );

    // =========================================================
    // ROOMS — Approved + Admin + sub-user
    // =========================================================
    app.post("/rooms", verifyToken, verifyHotelUser, async (req, res) => {
      const result = await roomCollection.insertOne({
        ...req.body,
        hotelEmail: req.body.hotelEmail || req.hotelEmail,
      });
      res.status(201).send(result);
    });

    app.get("/rooms", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const rooms = await roomCollection.find({ hotelEmail }).toArray();
      res.send(rooms);
    });

    app.get(
      "/rooms/maintenance",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const query = {
          roomStatus: { $in: ["Maintenance", "In Progress"] },
          hotelEmail,
        };

        const rooms = await roomCollection.find(query).toArray();
        res.send(rooms);
      },
    );

    app.get(
      "/rooms/maintenance/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room ID" });
        }
        const room = await roomCollection.findOne({
          _id: new ObjectId(id),
          roomStatus: { $in: ["Maintenance", "In Progress"] },
        });
        res.send(room);
      },
    );

    app.get(
      "/rooms/available",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { arriving, departure } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        if (!arriving || !departure) {
          return res.status(400).send({ message: "Dates required" });
        }

        const checkIns = await checkInCollection
          .find({
            hotelEmail,
            checkInDate: { $lte: departure },
            checkOutDate: { $gt: arriving },
          })
          .toArray();

        const reservations = await reservationCollection
          .find({
            hotelEmail,
            arrivingDate: { $lte: departure },
            departureDate: { $gt: arriving },
            status: "Reserved",
          })
          .toArray();

        const blocked = [
          ...new Set([
            ...checkIns.map((c) => String(c.roomNumber)),
            ...reservations.map((r) => String(r.room?.roomNo || r.roomNo)),
          ]),
        ];

        const rooms = await roomCollection
          .find({
            hotelEmail,
            roomNo: { $nin: blocked },
            roomStatus: { $ne: "Maintenance" },
          })
          .toArray();

        const grouped = {};
        rooms.forEach((room) => {
          const name = room.variantName || "Other";
          if (!grouped[name]) {
            grouped[name] = {
              variantName: room.variantName,
              baseRoomType: room.baseRoomType,
              price: room.price,
              maxOccupancy: room.maxOccupancy,
              bedType: room.bedType,
              amenities: room.amenities,
              description: room.description,
              image: room.image,
              rooms: [],
            };
          }
          grouped[name].rooms.push(room);
        });

        res.send({
          arriving,
          departure,
          totalAvailable: rooms.length,
          variants: Object.values(grouped),
        });
      },
    );

    app.get("/rooms/:id", verifyToken, verifyHotelUser, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid room ID" });
      }
      const result = await roomCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch("/rooms/:id", verifyToken, verifyHotelUser, async (req, res) => {
      const { id } = req.params;
      const { _id, ...updateData } = req.body;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid room ID" });
      }
      const result = await roomCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );
      res.send(result);
    });

    app.delete(
      "/room-delete/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room ID" });
        }
        const result = await roomCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      },
    );

    // =========================================================
    // MAINTENANCE HISTORY
    // =========================================================
    app.get(
      "/maintenance-history",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const result = await maintenanceHistoryCollection.find().toArray();
        res.send(result);
      },
    );

    app.get(
      "/maintenance-history/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid maintenance history ID" });
        }
        const result = await maintenanceHistoryCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      },
    );

    app.patch(
      "/edit-maintenance-history/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room ID" });
        }

        const { _id, ...cleanData } = req.body;

        const room_res = await roomCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: cleanData },
        );

        let history_res = null;
        if (cleanData.roomStatus === "Available") {
          history_res = await maintenanceHistoryCollection.insertOne({
            ...cleanData,
            roomID: new ObjectId(id),
            closedAt: new Date(),
          });
        }

        res.send({
          success: true,
          message: "Room updated successfully",
          history_res,
          room_res,
        });
      },
    );

    app.patch(
      "/change-maintenance-history/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid maintenance history ID" });
        }
        const { _id, ...updateData } = req.body;
        const result = await maintenanceHistoryCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.send({
          success: true,
          message: "Maintenance history updated successfully",
          result,
        });
      },
    );

    app.delete(
      "/maintenance-history/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .send({ message: "Invalid maintenance history ID" });
        }
        const result = await maintenanceHistoryCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      },
    );

    // =========================================================
    // ROOM VARIANTS
    // =========================================================
    app.post(
      "/add-room-variant",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        if (!req.files || !req.files.image) {
          return res.status(400).json({ message: "Image is required" });
        }

        const image = req.files.image;
        if (!image.mimetype.startsWith("image/")) {
          return res
            .status(400)
            .json({ message: "Only image files are allowed" });
        }

        const uploadDir = path.join(__dirname, "uploads", "room-variants");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueName =
          Date.now() +
          "-" +
          Math.round(Math.random() * 1e9) +
          path.extname(image.name);

        await image.mv(path.join(uploadDir, uniqueName));

        const roomVariant = {
          variantName: req.body.variantName,
          baseRoomType: req.body.baseRoomType,
          price: Number(req.body.price),
          maxOccupancy: Number(req.body.maxOccupancy),
          bedType: req.body.bedType || "",
          amenities: req.body.amenities || "",
          description: req.body.description || "",
          image: `/uploads/room-variants/${uniqueName}`,
          createdAt: new Date(),
          hotelEmail: req.body.hotelEmail || req.hotelEmail,
        };

        const result = await roomVariantCollection.insertOne(roomVariant);
        res.status(201).json(result);
      },
    );

    app.get(
      "/room-variants",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await roomVariantCollection
          .find({ hotelEmail })
          .toArray();
        res.send(result);
      },
    );

    app.get(
      "/room-variants/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room variant ID" });
        }
        const result = await roomVariantCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!result) {
          return res.status(404).send({ message: "Room variant not found" });
        }
        res.send(result);
      },
    );

    app.patch(
      "/room-variants/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room variant ID" });
        }

        const existingVariant = await roomVariantCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!existingVariant) {
          return res.status(404).send({ message: "Room variant not found" });
        }

        const oldVariantName = existingVariant.variantName;

        const updateData = {
          variantName: req.body.variantName,
          baseRoomType: req.body.baseRoomType,
          price: Number(req.body.price),
          maxOccupancy: Number(req.body.maxOccupancy),
          bedType: req.body.bedType || "",
          amenities: req.body.amenities || "",
          description: req.body.description || "",
        };

        if (req.files && req.files.image) {
          const image = req.files.image;
          if (!image.mimetype.startsWith("image/")) {
            return res
              .status(400)
              .json({ message: "Only image files are allowed" });
          }

          const uploadDir = path.join(__dirname, "uploads", "room-variants");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(image.name);

          await image.mv(path.join(uploadDir, uniqueName));
          updateData.image = `/uploads/room-variants/${uniqueName}`;
        }

        const result = await roomVariantCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );

        const roomsUpdateData = {
          variantName: updateData.variantName,
          baseRoomType: updateData.baseRoomType,
          price: updateData.price,
          maxOccupancy: updateData.maxOccupancy,
          bedType: updateData.bedType,
          amenities: updateData.amenities,
          description: updateData.description,
        };
        if (updateData.image) {
          roomsUpdateData.image = updateData.image;
        }

        await roomCollection.updateMany(
          { variantName: oldVariantName },
          { $set: roomsUpdateData },
        );

        res.send(result);
      },
    );

    app.delete(
      "/room-variants/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid room variant ID" });
        }

        const existingVariant = await roomVariantCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!existingVariant) {
          return res.status(404).send({ message: "Room variant not found" });
        }

        const variantName = existingVariant.variantName;

        const result = await roomVariantCollection.deleteOne({
          _id: new ObjectId(id),
        });

        await roomCollection.deleteMany({ variantName });

        res.send(result);
      },
    );

    app.get(
      "/rooms/variant/:variantId",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const { variantId } = req.params;

          if (!variantId) {
            return res.status(400).send({ message: "variantId is required" });
          }

          const result = await roomCollection
            .find({ variantId: variantId })
            .toArray();

          res.send(result);
        } catch (error) {
          console.error("Error fetching rooms by variant:", error);
          res.status(500).send({ message: "Failed to fetch rooms" });
        }
      },
    );

    // =========================================================
    // CHECK-IN
    // =========================================================
    app.post("/check-in", verifyToken, verifyHotelUser, async (req, res) => {
      try {
        if (!req.files || !req.files.nidImage || !req.files.personImage) {
          return res.status(400).json({
            message: "Both NID image and Person image are required",
          });
        }

        const nidImage = req.files.nidImage;
        const personImage = req.files.personImage;

        if (
          !nidImage.mimetype.startsWith("image/") ||
          !personImage.mimetype.startsWith("image/")
        ) {
          return res
            .status(400)
            .json({ message: "Only image files are allowed" });
        }

        const hotelEmail = req.body.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const roomNumber = String(req.body.roomNumber);
        const checkInDate = req.body.checkInDate;
        const checkOutDate = req.body.checkOutDate;
        const pricePerNight = Number(req.body.pricePerNight) || 0;
        const numberOfNights = Number(req.body.numberOfNights) || 0;
        const discountType = req.body.discountType || "amount";
        const discountValue = Number(req.body.discountValue) || 0;
        const advancePayment = Number(req.body.advancePayment) || 0;
        const reservationId = req.body.reservationId || null;

        if (!hotelEmail) {
          return res.status(400).json({ message: "hotelEmail is required" });
        }

        const subtotal = pricePerNight * numberOfNights;
        let discountAmount = 0;

        if (discountType === "percentage") {
          const pct = Math.min(Math.max(discountValue, 0), 100);
          discountAmount = (subtotal * pct) / 100;
        } else {
          discountAmount = Math.min(Math.max(discountValue, 0), subtotal);
        }

        const totalAmount = Math.max(subtotal - discountAmount, 0);
        const dueAmount = Math.max(totalAmount - advancePayment, 0);

        const reservationQuery = {
          hotelEmail,
          status: "Reserved",
          "room.roomNo": roomNumber,
          arrivingDate: { $lte: checkOutDate },
          departureDate: { $gte: checkInDate },
        };

        if (reservationId && ObjectId.isValid(reservationId)) {
          reservationQuery._id = { $ne: new ObjectId(reservationId) };
        }

        const reservationConflict =
          await reservationCollection.findOne(reservationQuery);

        if (reservationConflict) {
          return res.status(409).send({
            message: `Room ${roomNumber} is already reserved for the selected dates`,
          });
        }

        const checkInConflict = await checkInCollection.findOne({
          hotelEmail,
          roomNumber: roomNumber,
          status: { $ne: "Checked Out" },
          checkInDate: { $lte: checkOutDate },
          checkOutDate: { $gte: checkInDate },
        });

        if (checkInConflict) {
          return res.status(409).send({
            message: `Room ${roomNumber} is already occupied for the selected dates`,
          });
        }

        const uploadDir = path.join(__dirname, "uploads", "check-in");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const nidUniqueName =
          Date.now() +
          "-nid-" +
          Math.round(Math.random() * 1e9) +
          path.extname(nidImage.name);
        const personUniqueName =
          Date.now() +
          "-person-" +
          Math.round(Math.random() * 1e9) +
          path.extname(personImage.name);

        await nidImage.mv(path.join(uploadDir, nidUniqueName));
        await personImage.mv(path.join(uploadDir, personUniqueName));

        const checkInData = {
          hotelEmail,
          guestName: req.body.guestName,
          guestAddress: req.body.guestAddress,
          contactNumber: req.body.contactNumber,
          designation: req.body.designation,
          nidNumber: req.body.nidNumber || "",
          nidImage: `/uploads/check-in/${nidUniqueName}`,
          personImage: `/uploads/check-in/${personUniqueName}`,
          roomVariantId: req.body.roomVariantId,
          roomVariantName: req.body.roomVariantName,
          roomNumber: roomNumber,
          pricePerNight,
          checkInDate,
          checkInTime: req.body.checkInTime,
          checkOutDate,
          numberOfNights,
          numberOfGuests: Number(req.body.numberOfGuests) || 0,
          subtotal,
          discountType,
          discountValue,
          discountAmount,
          totalAmount,
          advancePayment,
          dueAmount,
          specialRequests: req.body.specialRequests || "",
          status: req.body.status || "Normal",
          restaurantOrders: [],
          restaurantTotalAmount: 0,
          laundryOrders: [],
          laundryTotalAmount: 0,
          transportOrders: [],
          transportTotalAmount: 0,
          roomChangeHistory: [],
          reservationId: reservationId || null,
          createdAt: new Date(),
        };

        const result = await checkInCollection.insertOne(checkInData);

        await roomCollection.updateOne(
          { roomNo: roomNumber, hotelEmail },
          { $set: { roomStatus: "Occupied" } },
        );

        if (reservationId && ObjectId.isValid(reservationId)) {
          await reservationCollection.updateOne(
            { _id: new ObjectId(reservationId) },
            {
              $set: {
                status: "Checked-In",
                checkedInAt: new Date(),
                checkInId: result.insertedId,
              },
            },
          );
        }

        res.status(201).send(result);
      } catch (error) {
        console.error("Check-in error:", error);
        res.status(500).send({ message: "Failed to check in guest" });
      }
    });

    app.get("/check-in", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await checkInCollection.find({ hotelEmail }).toArray();
      res.send(result);
    });

    app.get(
      "/check-in/all-dues",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        const checkIns = await checkInCollection
          .find({ hotelEmail })
          .sort({ createdAt: -1 })
          .toArray();

        const duesList = checkIns.map((checkIn) => {
          const roomDue = Number(checkIn.dueAmount) || 0;

          const restaurantDue = (checkIn.restaurantOrders || [])
            .filter((o) => o.paymentStatus === "Due")
            .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

          const laundryDue = (checkIn.laundryOrders || [])
            .filter((o) => o.paymentStatus === "Due")
            .reduce((sum, o) => sum + (Number(o.totalCost) || 0), 0);

          const transportDue = (checkIn.transportOrders || [])
            .filter((o) => o.paymentStatus === "Due")
            .reduce((sum, o) => sum + (Number(o.fare) || 0), 0);

          return {
            _id: checkIn._id,
            roomNumber: checkIn.roomNumber,
            guestName: checkIn.guestName,
            contactNumber: checkIn.contactNumber,
            checkInDate: checkIn.checkInDate,
            checkOutDate: checkIn.checkOutDate,
            roomDue,
            restaurantDue,
            laundryDue,
            transportDue,
            totalDue: roomDue + restaurantDue + laundryDue + transportDue,
          };
        });

        res.send(duesList);
      },
    );

    app.get("/check-in/:id", verifyToken, verifyHotelUser, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const result = await checkInCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch(
      "/check-in/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid guest ID" });
        }
        const result = await checkInCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: req.body },
        );
        res.send(result);
      },
    );

    app.post(
      "/banned-guests",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { checkinId } = req.body;
        const checkIn = await checkInCollection.findOne({
          _id: new ObjectId(checkinId),
        });
        if (!checkIn) {
          return res.status(404).send({ message: "Check-in record not found" });
        }

        await checkInCollection.updateOne(
          { _id: new ObjectId(checkinId) },
          { $set: { status: "Ban" } },
        );

        const result = await bannedGuestCollection.insertOne({
          hotelEmail: checkIn.hotelEmail,
          checkinId: checkIn._id,
          designation: checkIn.designation,
          guestName: checkIn.guestName,
          guestAddress: checkIn.guestAddress,
          nidNumber: checkIn.nidNumber,
          contactNumber: checkIn.contactNumber,
        });

        res.status(201).send({ result });
      },
    );

    app.delete(
      "/banned-guests/:checkinId",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { checkinId } = req.params;
        await bannedGuestCollection.deleteOne({
          checkinId: new ObjectId(checkinId),
        });
        await checkInCollection.updateOne(
          { _id: new ObjectId(checkinId) },
          { $set: { status: "Normal" } },
        );
        res.send({ success: true });
      },
    );

    app.get(
      "/banned-guests",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await bannedGuestCollection
          .find({ hotelEmail })
          .toArray();
        res.send(result);
      },
    );

    app.get(
      "/banned-guests/check/:nidNumber",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const result = await bannedGuestCollection.findOne({
          nidNumber: req.params.nidNumber,
        });
        res.send({ exists: !!result });
      },
    );

    // =========================================================
    // FOOD / SERVICES
    // =========================================================
    app.post("/food-menu", verifyToken, verifyHotelUser, async (req, res) => {
      const result = await foodMenuCollection.insertOne({
        ...req.body,
        createdAt: new Date(),
      });
      res.status(201).send(result);
    });

    app.get("/food-menu", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await foodMenuCollection.find({ hotelEmail }).toArray();
      res.send(result);
    });

    app.delete(
      "/food-menu/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid food item ID" });
        }
        const result = await foodMenuCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      },
    );

    app.patch(
      "/food-menu/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        const { _id, ...updateData } = req.body;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid food item ID" });
        }
        const result = await foodMenuCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );
        res.send(result);
      },
    );

    app.post(
      "/room-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const result = await roomServiceCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.status(201).send(result);
      },
    );

    app.get("/room-service", verifyToken, verifyHotelUser, async (req, res) => {
      const { active } = req.query;
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const filter = { hotelEmail };
      if (active) {
        filter.active_status = "active";
      }
      const result = await roomServiceCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.post(
      "/transport-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const result = await transportServiceCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
          });

          if (req.body.paymentStatus === "Due" && req.body.checkinId) {
            const transportOrder = {
              orderId: result.insertedId,
              pickupLocation: req.body.pickupLocation || "",
              destination: req.body.destination || "",
              pickupDate: req.body.pickupDate || "",
              pickupTime: req.body.pickupTime || "",
              vehicleType: req.body.vehicleType || "",
              driverNumber: req.body.driverNumber || "",
              fare: Number(req.body.fare) || 0,
              paymentStatus: "Due",
              orderedAt: new Date(),
            };

            await checkInCollection.updateOne(
              { _id: new ObjectId(req.body.checkinId) },
              {
                $push: { transportOrders: transportOrder },
                $inc: { transportTotalAmount: transportOrder.fare },
              },
            );
          }

          res.status(201).send(result);
        } catch (error) {
          console.error(error);
          res
            .status(500)
            .send({ message: "Failed to create transport service" });
        }
      },
    );

    app.get(
      "/transport-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await transportServiceCollection
          .find({ hotelEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      },
    );

    app.post(
      "/laundry-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const result = await laundryServiceCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
          });

          if (req.body.paymentStatus === "Due" && req.body.checkinId) {
            const laundryOrder = {
              orderId: result.insertedId,
              clothItems: (req.body.clothItems || []).map((item) => ({
                clothName: item.clothName || "",
                quantity: Number(item.quantity) || 0,
                price: Number(item.price) || 0,
                totalPrice:
                  (Number(item.quantity) || 0) * (Number(item.price) || 0),
              })),
              totalCost: Number(req.body.totalCost) || 0,
              laundryType: req.body.laundryType || "",
              pickupDate: req.body.pickupDate || "",
              deliveryDate: req.body.deliveryDate || "",
              assignedStaff: req.body.assignedStaff || "",
              specialInstructions: req.body.specialInstructions || "",
              paymentStatus: "Due",
              orderedAt: new Date(),
            };

            await checkInCollection.updateOne(
              { _id: new ObjectId(req.body.checkinId) },
              {
                $push: { laundryOrders: laundryOrder },
                $inc: { laundryTotalAmount: laundryOrder.totalCost },
              },
            );
          }

          res.status(201).send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to create laundry service" });
        }
      },
    );

    app.get(
      "/laundry-service",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await laundryServiceCollection
          .find({ hotelEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      },
    );

    // =========================================================
    // USERS (signup public, rest protected)
    // =========================================================
    app.post("/users", async (req, res) => {
      const { hotelName, hotelEmail, email1, email2, status } = req.body;

      const userData = {
        hotelName: hotelName || "",
        hotelEmail,
        email1: email1 || "",
        email2: email2 || "",
        status: status || "Pending",
        createdAt: new Date(),
      };

      const result = await usersCollection.insertOne(userData);
      res.status(201).send(result);
    });

    app.get("/users", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await usersCollection.findOne({ hotelEmail });
      res.send(result || {});
    });

    app.patch(
      "/users-status-change",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const { email, status } = req.body;

        if (!email || !status) {
          return res
            .status(400)
            .send({ message: "Email and status are required" });
        }

        const result = await usersCollection.updateOne(
          { hotelEmail: email },
          { $set: { status } },
        );

        res.send(result);
      },
    );

    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid user ID" });
        }

        const user = await usersCollection.findOne({ _id: new ObjectId(id) });
        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        const emails = [user.email1, user.email2, user.hotelEmail].filter(
          Boolean,
        );

        for (const email of emails) {
          try {
            const firebaseUser = await auth.getUserByEmail(email);
            await auth.deleteUser(firebaseUser.uid);
          } catch (firebaseError) {
            console.log("Firebase delete skipped:", firebaseError.message);
          }
        }

        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          deletedCount: result.deletedCount,
          message: "User deleted",
        });
      } catch (error) {
        console.error("Delete user error:", error);
        res.status(500).send({ message: "Failed to delete user" });
      }
    });

    app.patch("/users/:id", verifyToken, verifyHotelUser, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID" });
      }

      const updateData = { ...req.body };

      if (updateData.password1) {
        updateData.password1 = await bcrypt.hash(updateData.password1, 10);
      }
      if (updateData.password2) {
        updateData.password2 = await bcrypt.hash(updateData.password2, 10);
      }

      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key],
      );

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );

      res.send(result);
    });

    app.post(
      "/restaurant-orders",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const result = await restaurantOrderCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
          });

          const rawId =
            req.body.checkinId ||
            req.body.checkInId ||
            req.body.checkInInfo?._id ||
            null;

          if (!rawId) {
            return res.status(201).send(result);
          }

          let checkInObjectId;
          try {
            checkInObjectId = new ObjectId(rawId);
          } catch (err) {
            return res.status(201).send(result);
          }

          const restaurantOrder = {
            orderId: result.insertedId,
            foodItems: (req.body.foodItems || []).map((item) => ({
              itemName: item.itemName || "",
              quantity: Number(item.quantity) || 0,
              price: Number(item.price) || 0,
              totalPrice:
                (Number(item.quantity) || 0) * (Number(item.price) || 0),
              paymentStatus: req.body.paymentStatus || "Due",
            })),
            totalAmount: Number(req.body.totalAmount) || 0,
            orderDate: req.body.orderDate || "",
            orderTime: req.body.orderTime || "",
            paymentMethod: req.body.paymentMethod || "",
            paymentStatus: req.body.paymentStatus || "Due",
            orderedAt: new Date(),
          };

          const updateDoc = {
            $push: { restaurantOrders: restaurantOrder },
          };

          if (req.body.paymentStatus === "Due") {
            updateDoc.$inc = {
              restaurantTotalAmount: restaurantOrder.totalAmount,
            };
          }

          await checkInCollection.updateOne(
            { _id: checkInObjectId },
            updateDoc,
          );

          res.status(201).send(result);
        } catch (error) {
          console.error("Restaurant order error:", error);
          res
            .status(500)
            .send({ message: "Failed to create restaurant order" });
        }
      },
    );

    app.get(
      "/restaurant-orders",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await restaurantOrderCollection
          .find({ hotelEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      },
    );

    app.get(
      "/restaurant-orders/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid order ID" });
        }

        const result = await restaurantOrderCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Order not found" });
        }

        res.send(result);
      },
    );

    // =========================================================
    // RESERVATIONS
    // =========================================================
    app.post(
      "/reservations",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const reservationData = {
          ...req.body,
          hotelEmail: req.body.hotelEmail || req.hotelEmail,
          createdAt: new Date(),
        };

        const result = await reservationCollection.insertOne(reservationData);

        const today = new Date().toISOString().split("T")[0];
        const coversToday =
          req.body.arrivingDate <= today && req.body.departureDate >= today;

        if (coversToday && req.body.room?.roomNo) {
          await roomCollection.updateOne(
            {
              roomNo: String(req.body.room.roomNo),
              hotelEmail: reservationData.hotelEmail,
            },
            { $set: { roomStatus: "Reserved" } },
          );
        }

        if (req.body.room?.roomNo) {
          await updateRoomStatus(req.body.room.roomNo);
        }

        res.status(201).send(result);
      },
    );

    app.get("/reservations", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await reservationCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.patch(
      "/reservations/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid reservation ID" });
        }
        const result = await reservationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: req.body },
        );
        res.send(result);
      },
    );

    app.delete(
      "/reservations/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid reservation ID" });
        }

        const reservation = await reservationCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!reservation) {
          return res.status(404).send({ message: "Reservation not found" });
        }

        const result = await reservationCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (reservation.room?.roomNo) {
          await updateRoomStatus(reservation.room.roomNo);
        }

        res.send(result);
      },
    );

    // =========================================================
    // SALARY & PAYROLL — owner / admin only
    // =========================================================
    app.post(
      "/salary-structures",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const result = await salaryStructureCollection.insertOne({
            ...req.body,
            createdAt: new Date(),
          });
          res.status(201).send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to create salary structure" });
        }
      },
    );

    app.get(
      "/salary-structures",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const result = await salaryStructureCollection
            .find()
            .sort({ createdAt: -1 })
            .toArray();
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to get salary structures" });
        }
      },
    );

    app.get(
      "/salary-structures/employee/:employeeId",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const result = await salaryStructureCollection
            .find({ employeeId: req.params.employeeId })
            .sort({ createdAt: -1 })
            .toArray();
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to get employee salary structures" });
        }
      },
    );

    app.get(
      "/salary-structures/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).send({ message: "Invalid ID" });
          }
          const result = await salaryStructureCollection.findOne({
            _id: new ObjectId(req.params.id),
          });
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to get salary structure" });
        }
      },
    );

    app.patch(
      "/salary-structures/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const { _id, ...updateData } = req.body;
          if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).send({ message: "Invalid ID" });
          }
          const result = await salaryStructureCollection.updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: updateData },
          );
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to update salary structure" });
        }
      },
    );

    app.delete(
      "/salary-structures/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).send({ message: "Invalid ID" });
          }
          const result = await salaryStructureCollection.deleteOne({
            _id: new ObjectId(req.params.id),
          });
          res.send(result);
        } catch (error) {
          res
            .status(500)
            .send({ message: "Failed to delete salary structure" });
        }
      },
    );

    app.post("/payrolls", verifyToken, verifyOwnerOrAdmin, async (req, res) => {
      try {
        const result = await payrollCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to generate payroll" });
      }
    });

    app.get("/payrolls", verifyToken, verifyOwnerOrAdmin, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await payrollCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // =========================================================
    // HOTELS
    // =========================================================
    app.post("/hotels", async (req, res) => {
      try {
        if (!req.files || !req.files.logo) {
          return res.status(400).json({ message: "Hotel logo is required" });
        }

        const logo = req.files.logo;
        if (!logo.mimetype.startsWith("image/")) {
          return res
            .status(400)
            .json({ message: "Only image files are allowed" });
        }

        const uploadDir = path.join(__dirname, "uploads", "hotels");
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const uniqueName =
          Date.now() +
          "-" +
          Math.round(Math.random() * 1e9) +
          path.extname(logo.name);

        await logo.mv(path.join(uploadDir, uniqueName));

        const hashedPassword = await bcrypt.hash(req.body.password, 10);

        const hotelData = {
          hotelName: req.body.hotelName,
          propertyType: req.body.propertyType,
          address: req.body.address,
          ownerName: req.body.ownerName,
          email: req.body.email,
          phone: req.body.phone,
          password: hashedPassword,
          binNumber: req.body.binNumber || "",
          logo: `/uploads/hotels/${uniqueName}`,
          status: "Pending",
          createdAt: new Date(),
        };

        const result = await hotelCollection.insertOne(hotelData);
        res.status(201).send(result);
      } catch (error) {
        console.error("Hotel signup error:", error);
        res.status(500).send({ message: "Failed to create hotel account" });
      }
    });

    app.get("/hotels", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await hotelCollection
          .find({}, { projection: { password: 0 } })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get hotels" });
      }
    });

    app.get(
      "/hotels/by-email",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const email = req.query.email || req.hotelEmail;
          if (!email) {
            return res.status(400).send({ message: "Email is required" });
          }

          if (req.userType !== "admin" && email !== req.hotelEmail) {
            return res.status(403).send({ message: "Forbidden access" });
          }

          const hotel = await hotelCollection.findOne(
            { email },
            { projection: { password: 0 } },
          );

          if (!hotel) {
            return res.status(404).send({ message: "Hotel not found" });
          }

          res.send(hotel);
        } catch (error) {
          res.status(500).send({ message: "Failed to get hotel" });
        }
      },
    );

    app.patch(
      "/hotels/:id",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid hotel ID" });
          }

          const existing = await hotelCollection.findOne({
            _id: new ObjectId(id),
          });
          if (!existing) {
            return res.status(404).send({ message: "Hotel not found" });
          }

          const result = await hotelCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: req.body },
          );
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to update hotel" });
        }
      },
    );

    app.delete("/hotels/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid hotel ID" });
        }

        const hotel = await hotelCollection.findOne({ _id: new ObjectId(id) });

        if (!hotel) {
          return res.status(404).send({ message: "Hotel not found" });
        }

        try {
          const userRecord = await auth.getUserByEmail(hotel.email);
          await auth.deleteUser(userRecord.uid);
          console.log(`Firebase user deleted: ${hotel.email}`);
        } catch (firebaseError) {
          console.log(
            "Firebase user not found or already deleted:",
            firebaseError.message,
          );
        }

        const result = await hotelCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send({
          success: true,
          message: "Hotel deleted from Firebase and Database",
          deletedCount: result.deletedCount,
        });
      } catch (error) {
        console.error("Delete hotel error:", error);
        res.status(500).send({ message: "Failed to delete hotel" });
      }
    });

    app.patch(
      "/hotels/:id/logo",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid hotel ID" });
          }

          if (!req.files || !req.files.logo) {
            return res.status(400).json({ message: "Logo is required" });
          }

          const logo = req.files.logo;
          if (!logo.mimetype.startsWith("image/")) {
            return res
              .status(400)
              .json({ message: "Only image files are allowed" });
          }

          const uploadDir = path.join(__dirname, "uploads", "hotels");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }

          const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(logo.name);

          await logo.mv(path.join(uploadDir, uniqueName));

          const result = await hotelCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { logo: `/uploads/hotels/${uniqueName}` } },
          );

          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to update logo" });
        }
      },
    );

    // =========================================================
    // REPORTS — owner / admin only
    // =========================================================
    app.get(
      "/transportation-sales",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, contactNumber } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          hotelEmail,
          pickupDate: { $gte: fromDate, $lte: toDate },
        };
        if (contactNumber) {
          query.contactNumber = contactNumber;
        }
        const result = await transportServiceCollection
          .find(query)
          .sort({ pickupDate: 1, pickupTime: 1 })
          .toArray();

        res.send(result);
      },
    );

    app.get(
      "/room-sales",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, roomNumber } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          hotelEmail,
          checkedOutAt: {
            $gte: new Date(fromDate),
            $lte: new Date(toDate + "T23:59:59.999Z"),
          },
        };
        if (roomNumber) {
          query.roomNumber = roomNumber;
        }
        const result = await checkOutCollection
          .find(query)
          .sort({ checkedOutAt: 1 })
          .toArray();
        res.send(result);
      },
    );

    app.get(
      "/restaurant-sales",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, contactNumber } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          hotelEmail,
          orderDate: { $gte: fromDate, $lte: toDate },
        };
        if (contactNumber) {
          query["checkInInfo.contactNumber"] = contactNumber;
        }
        const result = await restaurantOrderCollection
          .find(query)
          .sort({ orderDate: 1, orderTime: 1 })
          .toArray();

        res.send(result);
      },
    );

    app.get(
      "/laundry-sales",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, contactNumber } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          hotelEmail,
          pickupDate: { $gte: fromDate, $lte: toDate },
        };
        if (contactNumber) {
          query.contactNumber = contactNumber;
        }
        const result = await laundryServiceCollection
          .find(query)
          .sort({ pickupDate: 1 })
          .toArray();
        res.send(result);
      },
    );

    app.get(
      "/salary-report",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, employeeId } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          hotelEmail,
          paidAt: {
            $gte: fromDate,
            $lte: toDate + "T23:59:59.999Z",
          },
        };
        if (employeeId) {
          query.employeeID = employeeId;
        }
        const payrolls = await payrollCollection
          .find(query)
          .sort({ paidAt: -1 })
          .toArray();
        const result = await Promise.all(
          payrolls.map(async (payroll) => {
            let employee = null;
            if (payroll.employeeId) {
              employee = await employeeCollection.findOne({
                _id: new ObjectId(payroll.employeeId),
              });
            }
            return {
              ...payroll,
              employeeDetails: employee || null,
            };
          }),
        );
        res.send(result);
      },
    );

    // =========================================================
    // EXPENSE
    // =========================================================
    app.post(
      "/expense-categories",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { categoryName } = req.body;
        const hotelEmail = req.body.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!categoryName || categoryName.trim() === "") {
          return res.status(400).send({ message: "Category name is required" });
        }
        if (!hotelEmail || hotelEmail.trim() === "") {
          return res.status(400).send({ message: "Hotel email is required" });
        }
        const exists = await expenseCategoryCollection.findOne({
          categoryName: categoryName.trim(),
          hotelEmail: hotelEmail.trim(),
        });
        if (exists) {
          return res.status(400).send({ message: "Category already exists" });
        }
        const result = await expenseCategoryCollection.insertOne({
          categoryName: categoryName.trim(),
          hotelEmail: hotelEmail.trim(),
          createdAt: new Date(),
        });
        res.status(201).send(result);
      },
    );

    app.get(
      "/expense-categories",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        const result = await expenseCategoryCollection
          .find({ hotelEmail })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      },
    );

    app.post(
      "/expense-entries",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const expense = {
          ...req.body,
          hotelEmail: req.body.hotelEmail || req.hotelEmail,
          createdAt: new Date(),
        };
        const result = await expenseEntryCollection.insertOne(expense);
        res.send(result);
      },
    );

    app.get(
      "/expense-overview",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        const { fromDate, toDate, categoryName } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;
        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }
        const query = {
          expenseDate: { $gte: fromDate, $lte: toDate },
          hotelEmail,
        };
        if (categoryName) {
          query.categoryName = categoryName;
        }
        const result = await expenseEntryCollection
          .find(query)
          .sort({ expenseDate: 1 })
          .toArray();
        res.send(result);
      },
    );

    // =========================================================
    // CHECKOUT
    // =========================================================
    app.post(
      "/check-out/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const { id } = req.params;
          if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid check-in ID" });
          }

          const checkIn = await checkInCollection.findOne({
            _id: new ObjectId(id),
          });
          if (!checkIn) {
            return res
              .status(404)
              .send({ message: "Check-in record not found" });
          }
          if (checkIn.status === "Checked Out") {
            return res
              .status(400)
              .send({ message: "Guest already checked out" });
          }

          const {
            actualCheckoutDate,
            actualNights,
            actualRoomCharge,
            restaurantDue,
            laundryDue,
            transportDue,
            totalCharges,
            advancePayment,
            finalAmount,
            isRefund,
          } = req.body;

          const checkoutData = {
            hotelEmail: checkIn.hotelEmail,
            guestName: checkIn.guestName,
            guestAddress: checkIn.guestAddress,
            contactNumber: checkIn.contactNumber,
            designation: checkIn.designation,
            nidNumber: checkIn.nidNumber || "",
            personImage: checkIn.personImage,
            nidImage: checkIn.nidImage,
            roomNumber: checkIn.roomNumber,
            roomVariantId: checkIn.roomVariantId,
            roomVariantName: checkIn.roomVariantName,
            pricePerNight: checkIn.pricePerNight,
            roomChangeHistory: checkIn.roomChangeHistory || [],
            checkInDate: checkIn.checkInDate,
            checkInTime: checkIn.checkInTime,
            checkOutDate: checkIn.checkOutDate,
            actualCheckoutDate:
              actualCheckoutDate || new Date().toISOString().split("T")[0],
            actualNights: Number(actualNights) || checkIn.numberOfNights,
            numberOfGuests: checkIn.numberOfGuests,
            numberOfNights: checkIn.numberOfNights,
            actualRoomCharge: Number(actualRoomCharge) || checkIn.totalAmount,
            restaurantDue: Number(restaurantDue) || 0,
            laundryDue: Number(laundryDue) || 0,
            transportDue: Number(transportDue) || 0,
            totalCharges: Number(totalCharges) || 0,
            advancePayment: Number(advancePayment) || checkIn.advancePayment,
            finalAmount: Number(finalAmount) || 0,
            isRefund: Boolean(isRefund),
            restaurantOrders: (checkIn.restaurantOrders || []).map((order) => ({
              ...order,
              paymentStatus: "Paid",
              foodItems: (order.foodItems || []).map((item) => ({
                ...item,
                paymentStatus: "Paid",
              })),
            })),
            laundryOrders: (checkIn.laundryOrders || []).map((order) => ({
              ...order,
              paymentStatus: "Paid",
            })),
            transportOrders: (checkIn.transportOrders || []).map((order) => ({
              ...order,
              paymentStatus: "Paid",
            })),
            originalCheckInId: checkIn._id,
            status: "Checked Out",
            checkedOutAt: new Date(),
            createdAt: checkIn.createdAt,
          };

          const insertResult = await checkOutCollection.insertOne(checkoutData);

          if (checkIn.restaurantOrders?.length > 0) {
            const ids = checkIn.restaurantOrders
              .map((o) => o.orderId)
              .filter(Boolean);
            if (ids.length) {
              await restaurantOrderCollection.updateMany(
                { _id: { $in: ids.map((oid) => new ObjectId(oid)) } },
                { $set: { paymentStatus: "Paid" } },
              );
            }
          }

          if (checkIn.laundryOrders?.length > 0) {
            const ids = checkIn.laundryOrders
              .map((o) => o.orderId)
              .filter(Boolean);
            if (ids.length) {
              await laundryServiceCollection.updateMany(
                { _id: { $in: ids.map((oid) => new ObjectId(oid)) } },
                { $set: { paymentStatus: "Paid" } },
              );
            }
          }

          if (checkIn.transportOrders?.length > 0) {
            const ids = checkIn.transportOrders
              .map((o) => o.orderId)
              .filter(Boolean);
            if (ids.length) {
              await transportServiceCollection.updateMany(
                { _id: { $in: ids.map((oid) => new ObjectId(oid)) } },
                { $set: { paymentStatus: "Paid" } },
              );
            }
          }

          await checkInCollection.deleteOne({ _id: new ObjectId(id) });
          await updateRoomStatus(checkIn.roomNumber);

          res.send({
            success: true,
            message: "Checkout completed successfully",
            checkoutId: insertResult.insertedId,
          });
        } catch (error) {
          console.error("Checkout error:", error);
          res.status(500).send({
            message: "Failed to complete checkout",
            error: error.message,
          });
        }
      },
    );

    app.get("/check-out", verifyToken, verifyHotelUser, async (req, res) => {
      const hotelEmail = req.query.hotelEmail || req.hotelEmail;
      if (!assertSameHotel(req, res, hotelEmail)) return;
      const result = await checkOutCollection
        .find({ hotelEmail })
        .sort({ checkedOutAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get(
      "/check-out/guest",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const { contactNumber, nidNumber } = req.query;
          const hotelEmail = req.query.hotelEmail || req.hotelEmail;
          if (!assertSameHotel(req, res, hotelEmail)) return;

          if (!hotelEmail) {
            return res.status(400).send({ message: "hotelEmail is required" });
          }

          const query = { hotelEmail };

          if (nidNumber && nidNumber.trim() !== "") {
            query.nidNumber = nidNumber;
          } else if (contactNumber) {
            query.contactNumber = contactNumber;
          } else {
            return res
              .status(400)
              .send({ message: "contactNumber or nidNumber is required" });
          }

          const result = await checkOutCollection
            .find(query)
            .sort({ checkedOutAt: -1 })
            .toArray();

          res.send(result);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to get guest checkouts" });
        }
      },
    );

    app.get(
      "/check-out/:id",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).send({ message: "Invalid ID" });
          }
          const result = await checkOutCollection.findOne({
            _id: new ObjectId(req.params.id),
          });
          if (!result) {
            return res
              .status(404)
              .send({ message: "Checkout record not found" });
          }
          res.send(result);
        } catch (error) {
          res.status(500).send({ message: "Failed to get checkout details" });
        }
      },
    );

    app.get(
      "/unique-guests",
      verifyToken,
      verifyHotelUser,
      async (req, res) => {
        try {
          const hotelEmail = req.query.hotelEmail || req.hotelEmail;
          if (!assertSameHotel(req, res, hotelEmail)) return;

          if (!hotelEmail) {
            return res.status(400).send({ message: "hotelEmail is required" });
          }

          const uniqueGuests = await checkOutCollection
            .aggregate([
              { $match: { hotelEmail: hotelEmail } },
              { $sort: { checkedOutAt: -1 } },
              {
                $group: {
                  _id: {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$nidNumber", ""] },
                          { $ne: ["$nidNumber", null] },
                        ],
                      },
                      "$nidNumber",
                      { $concat: ["$contactNumber", "_", "$guestName"] },
                    ],
                  },
                  guestName: { $first: "$guestName" },
                  contactNumber: { $first: "$contactNumber" },
                  nidNumber: { $first: "$nidNumber" },
                  guestAddress: { $first: "$guestAddress" },
                  designation: { $first: "$designation" },
                  personImage: { $first: "$personImage" },
                  totalStays: { $sum: 1 },
                  lastCheckoutDate: { $first: "$checkedOutAt" },
                  lastRoomNumber: { $first: "$roomNumber" },
                  lastRoomVariant: { $first: "$roomVariantName" },
                  totalSpent: {
                    $sum: {
                      $ifNull: [
                        "$totalCharges",
                        { $ifNull: ["$actualRoomCharge", "$totalAmount"] },
                      ],
                    },
                  },
                },
              },
              { $sort: { lastCheckoutDate: -1 } },
            ])
            .toArray();

          res.send(uniqueGuests);
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "Failed to get unique guests" });
        }
      },
    );

    app.get(
      "/refunded-checkouts",
      verifyToken,
      verifyOwnerOrAdmin,
      async (req, res) => {
        const { fromDate, toDate, contactNumber } = req.query;
        const hotelEmail = req.query.hotelEmail || req.hotelEmail;
        if (!assertSameHotel(req, res, hotelEmail)) return;

        if (!fromDate || !toDate) {
          return res
            .status(400)
            .send({ message: "Both fromDate and toDate are required" });
        }

        const query = {
          hotelEmail,
          isRefund: true,
          checkedOutAt: {
            $gte: new Date(fromDate),
            $lte: new Date(toDate + "T23:59:59.999Z"),
          },
        };

        if (contactNumber) {
          query.contactNumber = {
            $regex: contactNumber,
            $options: "i",
          };
        }

        const result = await checkOutCollection
          .find(query)
          .sort({ checkedOutAt: -1 })
          .toArray();

        res.send(result);
      },
    );

    // =========================================================
    // SMART ROOM STATUS UPDATER
    // =========================================================
    const updateRoomStatus = async (roomNo) => {
      try {
        roomNo = String(roomNo);

        const room = await roomCollection.findOne({ roomNo });
        if (!room) return;

        if (["Maintenance", "In Progress"].includes(room.roomStatus)) {
          return room.roomStatus;
        }

        const today = new Date().toISOString().split("T")[0];

        const activeCheckIn = await checkInCollection.findOne({
          roomNumber: roomNo,
          status: { $ne: "Checked Out" },
          checkInDate: { $lte: today },
          checkOutDate: { $gte: today },
        });

        if (activeCheckIn) {
          await roomCollection.updateOne(
            { roomNo },
            { $set: { roomStatus: "Occupied" } },
          );
          return "Occupied";
        }

        const activeReservation = await reservationCollection.findOne({
          status: "Reserved",
          "room.roomNo": roomNo,
          arrivingDate: { $lte: today },
          departureDate: { $gte: today },
        });

        if (activeReservation) {
          await roomCollection.updateOne(
            { roomNo },
            { $set: { roomStatus: "Reserved" } },
          );
          return "Reserved";
        }

        await roomCollection.updateOne(
          { roomNo },
          { $set: { roomStatus: "Available" } },
        );
        return "Available";
      } catch (error) {
        console.error("updateRoomStatus error:", error);
      }
    };

    const updateAllRoomStatuses = async () => {
      try {
        console.log("🔄 Updating all room statuses...");
        const rooms = await roomCollection
          .find({}, { projection: { roomNo: 1 } })
          .toArray();

        for (const room of rooms) {
          await updateRoomStatus(room.roomNo);
        }

        console.log(`✅ Updated ${rooms.length} rooms successfully`);
      } catch (error) {
        console.error("Failed to update room statuses:", error);
      }
    };

    updateAllRoomStatuses();
    setInterval(updateAllRoomStatuses, 24 * 60 * 60 * 1000);

    app.post("/change-room", verifyToken, verifyHotelUser, async (req, res) => {
      try {
        const {
          checkInId,
          newRoomNumber,
          newRoomVariantId,
          newRoomVariantName,
          newPricePerNight,
          daysStayed,
          remainingNights,
        } = req.body;

        if (!checkInId || !newRoomNumber) {
          return res.status(400).send({
            message: "checkInId and newRoomNumber are required",
          });
        }

        if (!ObjectId.isValid(checkInId)) {
          return res.status(400).send({ message: "Invalid check-in ID" });
        }

        const checkIn = await checkInCollection.findOne({
          _id: new ObjectId(checkInId),
        });

        if (!checkIn) {
          return res.status(404).send({ message: "Check-in record not found" });
        }

        if (checkIn.status === "Checked Out") {
          return res.status(400).send({ message: "Guest already checked out" });
        }

        const oldRoomNumber = String(checkIn.roomNumber);
        const newRoomNo = String(newRoomNumber);

        if (oldRoomNumber === newRoomNo) {
          return res.status(400).send({
            message: "New room cannot be the same as current room",
          });
        }

        const newRoom = await roomCollection.findOne({ roomNo: newRoomNo });

        if (!newRoom) {
          return res.status(404).send({ message: "New room not found" });
        }

        if (newRoom.roomStatus !== "Available") {
          return res.status(409).send({
            message: `Room ${newRoomNo} is not available (Status: ${newRoom.roomStatus})`,
          });
        }

        const stayed = Number(daysStayed) || 0;
        const oldPrice = Number(checkIn.pricePerNight) || 0;
        const costSoFar = stayed * oldPrice;

        const roomChangeRecord = {
          fromRoom: oldRoomNumber,
          fromVariant: checkIn.roomVariantName || "",
          fromPricePerNight: oldPrice,
          daysStayed: stayed,
          charge: costSoFar,
          transferredAt: new Date(),
        };

        const updateData = {
          roomChangeHistory: [
            ...(checkIn.roomChangeHistory || []),
            roomChangeRecord,
          ],
          roomNumber: newRoomNo,
          roomVariantId: newRoomVariantId || newRoom.variantId || newRoom._id,
          roomVariantName: newRoomVariantName || newRoom.variantName,
          pricePerNight: Number(newPricePerNight) || Number(newRoom.price) || 0,
          numberOfNights:
            Number(remainingNights) >= 0
              ? Number(remainingNights)
              : checkIn.numberOfNights - stayed,
          totalAmount:
            (Number(newPricePerNight) || Number(newRoom.price) || 0) *
            (Number(remainingNights) >= 0
              ? Number(remainingNights)
              : Math.max(checkIn.numberOfNights - stayed, 0)),
        };

        const result = await checkInCollection.updateOne(
          { _id: new ObjectId(checkInId) },
          { $set: updateData },
        );

        await roomCollection.updateOne(
          { roomNo: oldRoomNumber },
          { $set: { roomStatus: "Available" } },
        );

        await roomCollection.updateOne(
          { roomNo: newRoomNo },
          { $set: { roomStatus: "Occupied" } },
        );

        await updateRoomStatus(oldRoomNumber);
        await updateRoomStatus(newRoomNo);

        res.send({
          success: true,
          message: "Room transferred successfully",
          costSoFar,
          daysStayed: stayed,
          oldRoom: oldRoomNumber,
          newRoom: newRoomNo,
          result,
        });
      } catch (error) {
        console.error("Change room error:", error);
        res.status(500).send({
          message: "Failed to change room",
          error: error.message,
        });
      }
    });

    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
    // Keep connection open
  }
}

run().catch(console.dir);
