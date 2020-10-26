const nodemailer = require('nodemailer');
const { logger } = require('mcode-extraction-framework');

async function sendEmailNotification(notificationInfo, errors, debug) {
  const totalErrors = Object.keys(errors).reduce((previousValue, currentValue) => previousValue + errors[currentValue].length, 0);
  if (totalErrors === 0) {
    return;
  }

  if (!notificationInfo.to || !notificationInfo.host) {
    const errorMessage = `Email notification information incomplete. Unable to send email with ${totalErrors} errors.`
      + 'Update notificationInfo object in configuration in order to receive emails when errors occur.';
    throw new Error(errorMessage);
  }

  // Aggregate errors and build email message
  let emailBody = '';
  const fromAddress = notificationInfo.from || 'mCODE Extraction Errors mcode-extraction-errors@mitre.org';
  if (fromAddress.includes('mcode-extraction-errors@mitre.org')) {
    emailBody += '[This is an automated email from the mCODE Extraction Client. Do not reply to this message.]\n\n';
  }

  emailBody += 'Thank you for using the mCODE Extraction Client. ';
  emailBody += 'Unfortunately, the following errors occurred when running the extraction client:\n\n';
  Object.keys(errors).forEach((patientRow) => {
    emailBody += `Errors for patient at row ${parseInt(patientRow, 10) + 1} in .csv file:\n\n`;
    errors[patientRow].forEach((e) => {
      emailBody += `${e.message.trim()}\n`;
      if (debug) emailBody += `${e.stack}\n\n`;
    });
    if (errors[patientRow].length === 0) {
      emailBody += 'No errors for this patient. Extraction was successful.\n';
    }
    emailBody += '\n============================================================\n\n';
  });

  if (!debug) {
    emailBody += 'For additional stack trace information about these errors, run the extraction client using the `--debug` flag. ';
    emailBody += 'The stack trace information can be seen in the terminal as well as in the notification email.';
  }

  const transporter = nodemailer.createTransport({
    host: notificationInfo.host,
    ...(notificationInfo.port && { port: notificationInfo.port }),
  });

  logger.debug('Sending email with error information');
  await transporter.sendMail({
    from: fromAddress,
    to: notificationInfo.to,
    subject: 'mCODE Extraction Client Errors',
    text: emailBody,
  });
}

module.exports = {
  sendEmailNotification,
};
