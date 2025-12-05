import express  from "express";
import {prisma} from "./prisma/index.js"
const app = express()

import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const confirmPayment = async (req, res) => {
  console.log("got webhook from stripe");
  const sig = req.header("stripe-signature");
  let event;
  try {
    // ✅ Verify event came from Stripe
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log("Body : ", req.body);
  } catch (err) {
    console.error("⚠️ Webhook signature verification failed.", err.message);
    return res.status(200).send(`Webhook Error: ${err.message}`);
  }
  console.log("event : ",event);
  ;
  // ✅ Handle different event types

let metadata = event.data.object.metadata;
  if (event.type === "invoice.payment_succeeded") {
    // { instructorId: '7', userId: '43', courseId: '17' }
    
    // 3) Update order status in your DB
    const  s = await prisma.order.updateManyAndReturn({
      where: { userId:metadata.userId,courseId:metadata.courseId },
      data: {
        paymentStatus: "paid",
        
        orderStatus: "confirmed",
        invoiceUrl:event.data.object.hosted_invoice_url,
        
        
        payerId: metadata.userId,
      },
    });

    await prisma.studentCourse.create({
      data: {
        userId: metadata.userId,
        courseId: metadata.courseId,
        courseImage: metadata.courseImage,
        instructorId: metadata.instructorId,
        instructorName: metadata.instructorName,
        dateOfPurchase: metadata.orderDate,
        title: metadata.title,
      },
    });

    console.log(
      "added student in list of students who have purchased course  "
    );
    await prisma.courseStudent.create({
      data: {
        studentId: metadata.userId,
        studentName: metadata.userName,
        studentEmail: metadata.userEmail,
        paidAmount: parseFloat(metadata.coursePricing),
        courseId: parseInt(metadata.courseId+""),
      },
    });

    await prisma.course.update({ where: { id: parseInt(metadata.courseId) }, data: { noOfStudents: { increment: 1 } } });

    console.log("courrse purchased");

    // const mailOptions = {
    //   from: process.env.SENDER_EMAIL,
    //   to: metadata.userEmail,
    //   subject: "PaymentConfirmation",
    //   // text:registrationText
    //   html: PAYMENT_CONFIRMATION_TEMPLATE.replace("{{name}}", metadata.userName)
    //     .replace("{{courseTitle}}", metadata.title)
    //     .replace("{{amount}}", metadata.coursePricing)
    //     .replace("{{transactionId}}", event.id)
    //     .replace("{{purchaseDate}}", metadata.orderDate)
    //     .replace("{{receiptLink}}", event.data.object.hosted_invoice_url),
    // };
    // console.log("recipet url",event.data.object.receipt_url);

    // addToHighPriorityNotificationQueue("purchase email", mailOptions);
  }
  else if (event.type === "invoice_payment.unpaid" || event.type === "checkout.session.expired" || event.type === "invoice.payment_failed"|| event.type==="invoice.finalization_failed" || event.type==="inv") {
    await prisma.order.deleteMany({ where: { userId:metadata.userId,courseId:metadata.courseId } });
    console.log("deleted transaction");
  }
  else {
    console.log("its not our type : ",event.type);
  }
  console.log("Metadata : ",event.data.object.metadata);
  console.log("kuch nhi hwa bhai XD");
  return res.status(200).send(`done and dusted`);
    
}


app.post(
  "/student/order/confirm", // The full path to your webhook
  express.raw({ type: "application/json" }),
  confirmPayment
);
app.get("/", (req, res) => { res.status(200).json({ "message": "hello moto" }) })
app.get("/", (req, res) => res.send("Server is alive!"));
const port =  5001;
// app.listen(port, () => {
//   console.log(`app listening on port ${port}`);
//   // logger.info(`app listening on port ${port}`);
// });

export default app;
