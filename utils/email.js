const nodemailer = require("nodemailer");
const { htmlToText } = require("html-to-text");
const path = require("path");
const ejs = require("ejs");

class Email {
  constructor(user) {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: process.env.MAIL_PORT,
      secure: true,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
      },
    });
    this.user = user;
  }

  async send({ file, subject, body = {} }) {
    console.log("sending");
    const html = await ejs.renderFile(
      path.join(__dirname, "../emails", `${file}.ejs`),
      {
        otp: body.otp,
        url: body.resetUrl,
        firstName: this.user.firstName,
        trackingUrl: "#",
        supportUrl: "#",
      }
    );

    console.log(this.user.email);
    try {
      await this.transporter.sendMail({
        from: "Seamless Point test@roware.xyz",
        to: this.user.email,
        subject,
        html,
        text: htmlToText(html),
      });
      console.log("Message sent");
    } catch (error) {
      console.error("Error sending email:", error);
    }
  }

  async sendWelcome() {
    await this.send({
      file: "welcome",
      subject: "Welcome to the Seamless Point Family 🎉",
    });
  }

  async sendDeliveryComplete() {
    // Call the generic send method
    await this.send({
      file: "complete",
      subject: "Delivery Completed",
    });
  }

  async sendDeliveryFailed() {
    await this.send({
      file: "fail",
      subject: "Delivery Failed",
    });
  }

  async sendDeliveryCancelled() {
    await this.send({
      file: "cancel",
      subject: "Delivery Cancelled",
    });
  }

  async sendDeliveryOngoing() {
    await this.send({
      file: "ongoing",
      subject: "Delivery Ongoing",
      body: { trackingURl: "#" },
    });
  }

  async sendResetToken(resetUrl) {
    await this.send({
      file: "reset",
      subject: "Reset Password",
      body: { resetUrl },
    });
  }
}

module.exports = Email;
