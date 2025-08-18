import nodemailer from "nodemailer";

export async function sendEmail({
  attachmentPath,
  statsHuntersUrl,
  senderMail,
  author,
  date,
  receiverMail,
  smtp: { host, port, user, pass },
}) {
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  const formattedDate = new Intl.DateTimeFormat(
      "en",
      {
        dateStyle: "short",
      }
    ).format(date);

  const info = await transporter.sendMail({
    from: `"${author}" <${senderMail}>`,
    to: receiverMail,
    subject: `Meter Challenge – Daily Stats from ${author}, ${formattedDate}`,
    text: `Reporting my activities for today, aggregated by statshunters powered by strava: ${statsHuntersUrl}`,
    attachments: [
      {
        filename: `activity-${date.toISOString()}.png`,
        path: attachmentPath,
      },
    ],
  });

  console.log("✅ Email sent:", info.messageId);
}
