const express = require("express");
const cors = require("cors");
const multer = require("multer");
const nodemailer = require("nodemailer");
const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const PORT = process.env.PORT || 5000;
const GoogleGmailPassword = process.env.GOOGLE_GMAIL_PASSWORD;

const allowedOrigins = [
    "http://localhost:5173",
    "https://resume-mailer-frontend.vercel.app",
];

const app = express();
app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error("Not allowed by CORS"));
            }
        },
    })
);
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// === POST ROUTE ===
app.post("/send-emails", upload.fields([{ name: "excel" }, { name: "resume" }]), async (req, res) => {
    try {
        const excelPath = req.files.excel[0].path;
        const resumePath = req.files.resume[0].path;
        const message = req.body.message;
        const subject = req.body.subject;

        const workbook = XLSX.readFile(excelPath);
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        // Gmail transporter (replace with your credentials)
        const transporter = nodemailer.createTransport({
            pool: true,
            service: "gmail",
            port: 465,
            auth: {
                user: "abhishah578@gmail.com",
                pass: GoogleGmailPassword,
            },
            maxConnections: 1,
            maxMessages: 200,
        });

        // --- Helper function to chunk an array ---
        function chunkArray(arr, size) {
            const chunks = [];
            for (let i = 0; i < arr.length; i += size) {
                chunks.push(arr.slice(i, i + size));
            }
            return chunks;
        }

        const recruiterChunks = chunkArray(data, 50);

        for (const chunk of recruiterChunks) {
            const sendMailPromises = [];
            for (const recruiter of chunk) {
                const email = recruiter.Email || recruiter.email;
                const company = recruiter.Company || recruiter.company || "";

                if (!email) continue;

                const mailOptions = {
                    from: "abhishah578@gmail.com",
                    to: email,
                    subject: subject,
                    html: message.replace("{{company}}", company),
                    attachments: [
                        {
                            filename: "Abhi_Shah_Resume.pdf",
                            path: resumePath,
                        },
                    ],
                };

                sendMailPromises.push(transporter.sendMail(mailOptions));

                console.log("Batch of 50 emails sent successfully.");
                await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 sec delay between chunks
            }

            await Promise.all(sendMailPromises);
        }

        // Cleanup files
        fs.unlinkSync(excelPath);
        fs.unlinkSync(resumePath);

        res.json({ message: "All emails sent successfully!" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Error sending emails", error: error.message });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
