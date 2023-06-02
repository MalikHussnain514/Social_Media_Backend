const nodeMailer = require("nodemailer");

exports.sendEmail = async (options) => {
  var transport = nodeMailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: "8807ebf8e5c539",
      pass: "28aca59a545a44",
    },
  });

  const mailOptions = {
    from: "malikhussnain514@gmail.com",
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  await transport.sendMail(mailOptions);
};
