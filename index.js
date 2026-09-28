// Force Node.js to use Google and Cloudflare public DNS resolvers
require("node:dns").setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcrypt");

// ========== MODULAR FIREBASE ADMIN ==========
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

dotenv.config();


const decoded = Buffer.from(process.env.FB_SERVICE_KEY, 'base64').toString('utf8')
const serviceAccount = JSON.parse(decoded);

initializeApp({
  credential: cert(serviceAccount),
});

const auth = getAuth();
// ============================================


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(fileUpload());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// MongoDB Connection URI
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

    // =========================================================
    // ALL COLLECTIONS
    // =========================================================
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
    // ROOT
    // =========================================================
    app.get("/", (req, res) => {
      res.send("Hotel Software Server is Running 🚀");
    });

    // =========================================================
    // DASHBOARD STATS
    // =========================================================
    app.get("/dashboard/stats", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;

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
    });

    // =========================================================
    // CUSTOMERS PER MONTH
    // =========================================================
    app.get("/dashboard/customers-per-month", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;

      const checkouts = await checkOutCollection.find({ hotelEmail }).toArray();

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
    });

    // =========================================================
    // REVENUE BY SERVICE
    // =========================================================
    app.get("/dashboard/revenue-by-service", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;

      const checkouts = await checkOutCollection.find({ hotelEmail }).toArray();

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
    });
    // =========================================================
    // EMPLOYEES
    // =========================================================
    app.post("/employees", async (req, res) => {
      try {
        if (!req.files || !req.files.image) {
          return res.status(400).json({ message: "Profile photo is required" });
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
          hotelEmail: req.body.hotelEmail,
        };

        const result = await employeeCollection.insertOne(employee);
        res.status(201).send(result);
      } catch (error) {
        console.error("Add employee error:", error);
        res.status(500).send({ message: "Failed to add employee" });
      }
    });

    app.get("/employees/active", async (req, res) => {
      const { hotelEmail } = req.query;
      const employees = await employeeCollection
        .find({
          hotelEmail,
          EmploymentStatus: { $in: ["Active", "On Leave"] },
        })
        .toArray();
      res.send(employees);
    });

    app.get("/employees/inactive", async (req, res) => {
      const { hotelEmail } = req.query;
      const employees = await employeeCollection
        .find({
          hotelEmail,
          EmploymentStatus: { $in: ["Resigned", "Terminated"] },
        })
        .toArray();
      res.send(employees);
    });

    app.get("/employees/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid employee ID" });
      }
      const employee = await employeeCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(employee);
    });

    app.patch("/employees/:id", async (req, res) => {
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
    });

    // =========================================================
    // ROOMS
    // =========================================================
    app.post("/rooms", async (req, res) => {
      const result = await roomCollection.insertOne(req.body);
      res.status(201).send(result);
    });

    app.get("/rooms", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;
      const rooms = await roomCollection.find({ hotelEmail }).toArray();
      res.send(rooms);
    });

    app.get("/rooms/maintenance", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;

      const query = {
        roomStatus: { $in: ["Maintenance", "In Progress"] },
      };

      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
      }

      const rooms = await roomCollection.find(query).toArray();
      res.send(rooms);
    });

    app.get("/rooms/maintenance/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid room ID" });
      }
      const room = await roomCollection.findOne({
        _id: new ObjectId(id),
        roomStatus: { $in: ["Maintenance", "In Progress"] },
      });
      res.send(room);
    });

    app.get("/rooms/available", async (req, res) => {
      const { arriving, departure, hotelEmail } = req.query;

      if (!arriving || !departure) {
        return res.status(400).send({ message: "Dates required" });
      }

      // Correct overlap logic
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
    });

    app.get("/rooms/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid room ID" });
      }
      const result = await roomCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch("/rooms/:id", async (req, res) => {
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

    app.delete("/room-delete/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid room ID" });
      }
      const result = await roomCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // =========================================================
    // MAINTENANCE HISTORY
    // =========================================================
    app.get("/maintenance-history", async (req, res) => {
      const result = await maintenanceHistoryCollection.find().toArray();
      res.send(result);
    });

    app.get("/maintenance-history/:id", async (req, res) => {
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
    });

    app.patch("/edit-maintenance-history/:id", async (req, res) => {
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
    });

    app.patch("/change-maintenance-history/:id", async (req, res) => {
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
    });

    app.delete("/maintenance-history/:id", async (req, res) => {
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
    });

    // =========================================================
    // ROOM VARIANTS
    // =========================================================
    app.post("/add-room-variant", async (req, res) => {
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
        hotelEmail: req.body.hotelEmail,
      };

      const result = await roomVariantCollection.insertOne(roomVariant);
      res.status(201).json(result);
    });

    app.get("/room-variants", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;
      const result = await roomVariantCollection
        .find({ hotelEmail: hotelEmail })
        .toArray();
      res.send(result);
    });

    app.get("/room-variants/:id", async (req, res) => {
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
    });

    app.patch("/room-variants/:id", async (req, res) => {
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
    });

    app.delete("/room-variants/:id", async (req, res) => {
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
    });

    app.get("/rooms/variant/:variantId", async (req, res) => {
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
    });

    // =========================================================
    // CHECK-IN
    // =========================================================
    app.post("/check-in", async (req, res) => {
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

        const hotelEmail = req.body.hotelEmail;
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

        // ---- Server-side discount calculation ----
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

        // ---- Check existing Reservations (same hotel only) ----
        const reservationQuery = {
          hotelEmail,
          status: "Reserved",
          "room.roomNo": roomNumber,
          arrivingDate: { $lte: checkOutDate },
          departureDate: { $gte: checkInDate },
        };

        // Skip conflict if this check-in is for THAT reservation
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

        // ---- Check existing active Check-Ins (same hotel only) ----
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

        // ---- Upload images ----
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

        // ---- Build check-in document ----
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

          // Payment + Discount
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

        // ---- Mark room as Occupied (same hotel only) ----
        await roomCollection.updateOne(
          { roomNo: roomNumber, hotelEmail },
          { $set: { roomStatus: "Occupied" } },
        );

        // ---- If came from a reservation → mark it Checked-In ----
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

    app.get("/check-in", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;
      const query = {};
      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
      }
      const result = await checkInCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/check-in/all-dues", async (req, res) => {
      const { hotelEmail } = req.query;

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
    });

    app.get("/check-in/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID" });
      }
      const result = await checkInCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch("/check-in/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid guest ID" });
      }
      const result = await checkInCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body },
      );
      res.send(result);
    });

    // Banned Guests
    app.post("/banned-guests", async (req, res) => {
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
    });

    app.delete("/banned-guests/:checkinId", async (req, res) => {
      const { checkinId } = req.params;
      await bannedGuestCollection.deleteOne({
        checkinId: new ObjectId(checkinId),
      });
      await checkInCollection.updateOne(
        { _id: new ObjectId(checkinId) },
        { $set: { status: "Normal" } },
      );
      res.send({ success: true });
    });

    app.get("/banned-guests", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;
      const query = {};
      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
      }
      const result = await bannedGuestCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/banned-guests/check/:nidNumber", async (req, res) => {
      const result = await bannedGuestCollection.findOne({
        nidNumber: req.params.nidNumber,
      });
      res.send({ exists: !!result });
    });

    // =========================================================
    // FOOD MENU
    // =========================================================
    app.post("/food-menu", async (req, res) => {
      const result = await foodMenuCollection.insertOne({
        ...req.body,
        createdAt: new Date(),
      });
      res.status(201).send(result);
    });

    app.get("/food-menu", async (req, res) => {
      const { hotelEmail } = req.query;
      const result = await foodMenuCollection.find({ hotelEmail }).toArray();
      res.send(result);
    });

    app.delete("/food-menu/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid food item ID" });
      }
      const result = await foodMenuCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    app.patch("/food-menu/:id", async (req, res) => {
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
    });

    // Room Services
    app.post("/room-service", async (req, res) => {
      const result = await roomServiceCollection.insertOne({
        ...req.body,
        createdAt: new Date(),
      });
      res.status(201).send(result);
    });

    app.get("/room-service", async (req, res) => {
      const { active, hotelEmail } = req.query;
      const filter = {};
      if (active) {
        filter.active_status = "active";
      }
      if (hotelEmail) {
        filter.hotelEmail = hotelEmail;
      }
      const result = await roomServiceCollection
        .find(filter)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // =========================================================
    // TRANSPORT / LAUNDRY / RESTAURANT
    // =========================================================
    app.post("/transport-service", async (req, res) => {
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
        res.status(500).send({ message: "Failed to create transport service" });
      }
    });

    app.get("/transport-service", async (req, res) => {
      const { hotelEmail } = req.query;
      const result = await transportServiceCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/laundry-service", async (req, res) => {
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
    });

    app.get("/laundry-service", async (req, res) => {
      const { hotelEmail } = req.query;
      const result = await laundryServiceCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // users starts from here

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

    // GET sub users by hotelEmail
    app.get("/users", async (req, res) => {
      const { hotelEmail } = req.query;
      if (!hotelEmail) {
        return res.status(400).send({ message: "hotelEmail is required" });
      }

      const result = await usersCollection.findOne({ hotelEmail });
      res.send(result || {});
    });

    app.patch("/users-status-change", async (req, res) => {
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
    });

    // UPDATE sub users
    app.patch("/users/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid ID" });
      }

      const updateData = { ...req.body };

      // Hash password if provided
      if (updateData.password1) {
        updateData.password1 = await bcrypt.hash(updateData.password1, 10);
      }
      if (updateData.password2) {
        updateData.password2 = await bcrypt.hash(updateData.password2, 10);
      }

      // Remove undefined fields
      Object.keys(updateData).forEach(
        (key) => updateData[key] === undefined && delete updateData[key],
      );

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData },
      );

      res.send(result);
    });

    app.get("/users/:email/status", async (req, res) => {
      try {
        const email = req.params.email;

        // 1. First check if this is a Hotel Owner
        const hotel = await hotelCollection.findOne(
          { email },
          { projection: { status: 1, email: 1 } },
        );

        if (hotel) {
          return res.send({
            status: hotel.status,
            type: hotel.status === "Admin" ? "admin" : "owner",
            hotelEmail: hotel.email,
          });
        }

        // 2. Check if this email is a Sub User (email1 or email2)
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

        // 3. Not found
        return res.status(404).send({ status: "Pending" });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get status" });
      }
    });

    app.post("/restaurant-orders", async (req, res) => {
      try {
        const result = await restaurantOrderCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });

        // Accept every possible name the frontend might send
        const rawId =
          req.body.checkinId ||
          req.body.checkInId ||
          req.body.checkInInfo?._id ||
          null;

        // console.log("Received checkinId:", rawId);

        if (!rawId) {
          console.log("No checkinId → order saved but not linked to check-in");
          return res.status(201).send(result);
        }

        let checkInObjectId;
        try {
          checkInObjectId = new ObjectId(rawId);
        } catch (err) {
          console.log("Invalid ObjectId:", rawId);
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

        // Push for BOTH Due and Paid
        const updateDoc = {
          $push: { restaurantOrders: restaurantOrder },
        };

        // Only increase the due amount when status is Due
        if (req.body.paymentStatus === "Due") {
          updateDoc.$inc = {
            restaurantTotalAmount: restaurantOrder.totalAmount,
          };
        }

        const updateResult = await checkInCollection.updateOne(
          { _id: checkInObjectId },
          updateDoc,
        );

        // console.log("matchedCount:", updateResult.matchedCount);
        // console.log("modifiedCount:", updateResult.modifiedCount);

        if (updateResult.matchedCount === 0) {
          console.log(
            "No check-in found with _id:",
            checkInObjectId.toString(),
          );
        }

        res.status(201).send(result);
      } catch (error) {
        console.error("Restaurant order error:", error);
        res.status(500).send({ message: "Failed to create restaurant order" });
      }
    });

    app.get("/restaurant-orders", async (req, res) => {
      const { hotelEmail } = req.query;
      const result = await restaurantOrderCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/restaurant-orders/:id", async (req, res) => {
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
    });

    // =========================================================
    // RESERVATIONS
    // =========================================================
    app.post("/reservations", async (req, res) => {
      const reservationData = {
        ...req.body,
        createdAt: new Date(),
      };

      // 1. Insert reservation
      const result = await reservationCollection.insertOne(reservationData);

      // 2. Only mark room as "Reserved" if the reservation covers TODAY
      const today = new Date().toISOString().split("T")[0];
      const coversToday =
        req.body.arrivingDate <= today && req.body.departureDate >= today;

      if (coversToday && req.body.room?.roomNo) {
        await roomCollection.updateOne(
          {
            roomNo: String(req.body.room.roomNo),
            hotelEmail: req.body.hotelEmail,
          },
          { $set: { roomStatus: "Reserved" } },
        );
      }

      // 3. Always recalculate the room status
      if (req.body.room?.roomNo) {
        await updateRoomStatus(req.body.room.roomNo);
      }

      res.status(201).send(result);
    });

    app.get("/reservations", async (req, res) => {
      const { hotelEmail } = req.query;
      const result = await reservationCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.patch("/reservations/:id", async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ message: "Invalid reservation ID" });
      }
      const result = await reservationCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: req.body },
      );
      res.send(result);
    });

    app.delete("/reservations/:id", async (req, res) => {
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

      // Recalculate room status after deletion
      if (reservation.room?.roomNo) {
        await updateRoomStatus(reservation.room.roomNo);
      }

      res.send(result);
    });

    // =========================================================
    // SALARY & PAYROLL
    // =========================================================
    app.post("/salary-structures", async (req, res) => {
      try {
        const result = await salaryStructureCollection.insertOne({
          ...req.body,
          createdAt: new Date(),
        });
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to create salary structure" });
      }
    });

    app.get("/salary-structures", async (req, res) => {
      try {
        const result = await salaryStructureCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get salary structures" });
      }
    });

    app.get("/salary-structures/employee/:employeeId", async (req, res) => {
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
    });

    app.get("/salary-structures/:id", async (req, res) => {
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
    });

    app.patch("/salary-structures/:id", async (req, res) => {
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
        res.status(500).send({ message: "Failed to update salary structure" });
      }
    });

    app.delete("/salary-structures/:id", async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: "Invalid ID" });
        }
        const result = await salaryStructureCollection.deleteOne({
          _id: new ObjectId(req.params.id),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to delete salary structure" });
      }
    });

    app.post("/payrolls", async (req, res) => {
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

    app.get("/payrolls", async (req, res) => {
      const { hotelEmail } = req.query;
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

    app.get("/hotels", async (req, res) => {
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

    app.get("/hotels/by-email", async (req, res) => {
      try {
        const { email } = req.query;
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
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
    });

    app.patch("/hotels/:id", async (req, res) => {
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
    });

    app.delete("/hotels/:id", async (req, res) => {
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

    app.patch("/hotels/:id/logo", async (req, res) => {
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
    });

    // =========================================================
    // REPORTS
    // =========================================================
    app.get("/transportation-sales", async (req, res) => {
      const { fromDate, toDate, contactNumber, hotelEmail } = req.query;
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
    });

    app.get("/room-sales", async (req, res) => {
      const { fromDate, toDate, roomNumber, hotelEmail } = req.query;
      if (!fromDate || !toDate) {
        return res
          .status(400)
          .send({ message: "Both fromDate and toDate are required" });
      }
      const query = {
        checkedOutAt: {
          $gte: new Date(fromDate),
          $lte: new Date(toDate + "T23:59:59.999Z"),
        },
      };
      if (roomNumber) {
        query.roomNumber = roomNumber;
      }
      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
      }
      const result = await checkOutCollection
        .find(query)
        .sort({ checkedOutAt: 1 })
        .toArray();
      res.send(result);
    });

    app.get("/restaurant-sales", async (req, res) => {
      const { fromDate, toDate, contactNumber, hotelEmail } = req.query;
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
    });

    app.get("/laundry-sales", async (req, res) => {
      const { fromDate, toDate, contactNumber, hotelEmail } = req.query;
      if (!fromDate || !toDate) {
        return res
          .status(400)
          .send({ message: "Both fromDate and toDate are required" });
      }
      const query = {
        pickupDate: { $gte: fromDate, $lte: toDate },
      };
      if (contactNumber) {
        query.contactNumber = contactNumber;
      }
      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
      }
      const result = await laundryServiceCollection
        .find(query)
        .sort({ pickupDate: 1 })
        .toArray();

      res.send(result);
    });

    app.get("/salary-report", async (req, res) => {
      const { fromDate, toDate, employeeId, hotelEmail } = req.query;
      if (!fromDate || !toDate) {
        return res
          .status(400)
          .send({ message: "Both fromDate and toDate are required" });
      }
      const query = {
        paidAt: {
          $gte: fromDate,
          $lte: toDate + "T23:59:59.999Z",
        },
      };
      if (employeeId) {
        query.employeeID = employeeId;
      }
      if (hotelEmail) {
        query.hotelEmail = hotelEmail;
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
    });

    // =========================================================
    // EXPENSE
    // =========================================================
    app.post("/expense-categories", async (req, res) => {
      const { categoryName, hotelEmail } = req.body;
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
    });

    app.get("/expense-categories", async (req, res) => {
      const { hotelEmail } = req.query;
      if (!hotelEmail) {
        return res.status(400).send({ message: "Hotel email is required" });
      }
      const result = await expenseCategoryCollection
        .find({ hotelEmail })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/expense-entries", async (req, res) => {
      const expense = { ...req.body, createdAt: new Date() };
      const result = await expenseEntryCollection.insertOne(expense);
      res.send(result);
    });

    app.get("/expense-overview", async (req, res) => {
      const { fromDate, toDate, categoryName, hotelEmail } = req.query;
      if (!fromDate || !toDate) {
        return res
          .status(400)
          .send({ message: "Both fromDate and toDate are required" });
      }
      if (!hotelEmail) {
        return res.status(400).send({ message: "Hotel email is required" });
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
    });

    // =========================================================
    // CHECKOUT (Improved - Clean per-stay data)
    // =========================================================
    app.post("/check-out/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid check-in ID" });
        }

        const checkIn = await checkInCollection.findOne({
          _id: new ObjectId(id),
        });
        if (!checkIn) {
          return res.status(404).send({ message: "Check-in record not found" });
        }
        if (checkIn.status === "Checked Out") {
          return res.status(400).send({ message: "Guest already checked out" });
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

        // Clean checkout document - only this stay's data
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

        // Mark related orders as Paid
        if (checkIn.restaurantOrders?.length > 0) {
          const ids = checkIn.restaurantOrders
            .map((o) => o.orderId)
            .filter(Boolean);
          if (ids.length) {
            await restaurantOrderCollection.updateMany(
              { _id: { $in: ids.map((id) => new ObjectId(id)) } },
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
              { _id: { $in: ids.map((id) => new ObjectId(id)) } },
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
              { _id: { $in: ids.map((id) => new ObjectId(id)) } },
              { $set: { paymentStatus: "Paid" } },
            );
          }
        }

        // Delete the check-in record
        await checkInCollection.deleteOne({ _id: new ObjectId(id) });

        // Update room status
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
    });

    app.get("/check-out", async (req, res) => {
      const hotelEmail = req.query.hotelEmail;
      const result = await checkOutCollection
        .find({ hotelEmail })
        .sort({ checkedOutAt: -1 })
        .toArray();
      res.send(result);
    });

    // NEW: Get all checkouts of a specific guest
    app.get("/check-out/guest", async (req, res) => {
      try {
        const { hotelEmail, contactNumber, nidNumber } = req.query;

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
    });

    app.get("/check-out/:id", async (req, res) => {
      try {
        if (!ObjectId.isValid(req.params.id)) {
          return res.status(400).send({ message: "Invalid ID" });
        }
        const result = await checkOutCollection.findOne({
          _id: new ObjectId(req.params.id),
        });
        if (!result) {
          return res.status(404).send({ message: "Checkout record not found" });
        }
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to get checkout details" });
      }
    });

    // =========================================================
    // UNIQUE GUESTS
    // =========================================================
    app.get("/unique-guests", async (req, res) => {
      try {
        const hotelEmail = req.query.hotelEmail;

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
    });

    app.get("/refunded-checkouts", async (req, res) => {
      const { fromDate, toDate, contactNumber, hotelEmail } = req.query;

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
    });

    // =========================================================
    // USER STATUS (for PrivateRoute)
    // =========================================================
    app.get("/users/:email/status", async (req, res) => {
      try {
        const email = req.params.email;

        const hotel = await hotelCollection.findOne(
          { email: email },
          { projection: { status: 1 } },
        );

        if (!hotel) {
          return res.status(404).send({ status: "Pending" });
        }

        res.send({ status: hotel.status });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to get status" });
      }
    });

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

    // =========================================================
    // CHANGE ROOM (Room Transfer) - Only one definition
    // =========================================================
    app.post("/change-room", async (req, res) => {
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

    // =========================================================
    // START SERVER
    // =========================================================
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } finally {
    // Keep connection open
  }
}

run().catch(console.dir);
