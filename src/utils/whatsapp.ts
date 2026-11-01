import { Alert, Linking } from 'react-native';

export type WhatsAppAppointmentDetails = {
  phone?: string;
  serialNumber: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  fee: number;
  clinicName?: string;
};

export function formatWhatsAppMessage(
  details: WhatsAppAppointmentDetails
): string {
  const feeText = `৳${details.fee.toLocaleString()}`;

  return [
    `*${details.clinicName || 'CarePoint Medical Center'}*`,
    `*Appointment Confirmation Slip*`,
    `----------------------------------------`,
    `*Serial Number:* *${details.serialNumber}*`,
    `*Patient Name:* ${details.patientName}`,
    `*Doctor:* ${details.doctorName}`,
    `*Specialty:* ${details.specialty}`,
    `*Date:* ${details.date}`,
    `*Time Slot:* ${details.time}`,
    `*Consultation Fee:* ${feeText}`,
    `----------------------------------------`,
    `*Important Instructions:*`,
    `- Please arrive 15 minutes before your serial time.`,
    `- Present this serial number at the clinic reception.`,
    `- Bring any previous prescriptions or lab reports.`,
    `----------------------------------------`,
    `Need help or need to reschedule? Reply to this message.`,
    `Thank you for choosing CarePoint!`,
  ].join('\n');
}

export function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9+]/g, '');

  // Format Bangladesh numbers: e.g. 017xxxxxxxx -> 88017xxxxxxxx
  if (/^01[3-9]\d{8}$/.test(clean)) {
    clean = `880${clean.slice(1)}`;
  } else if (/^\+8801[3-9]\d{8}$/.test(clean)) {
    clean = clean.replace(/^\+/, '');
  }

  return clean;
}

export async function sendWhatsAppNotification(
  details: WhatsAppAppointmentDetails
): Promise<boolean> {
  const message = formatWhatsAppMessage(details);
  const encodedMessage = encodeURIComponent(message);
  const cleanPhone = cleanPhoneNumber(details.phone);

  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  try {
    const supported = await Linking.canOpenURL(url).catch(() => true);
    if (supported) {
      await Linking.openURL(url);
      return true;
    }

    Alert.alert(
      'WhatsApp Not Available',
      'Could not open WhatsApp. Please ensure WhatsApp is installed on this device.'
    );
    return false;
  } catch (error) {
    console.warn('Error opening WhatsApp:', error);
    try {
      await Linking.openURL(
        `https://api.whatsapp.com/send?text=${encodedMessage}`
      );
      return true;
    } catch {
      Alert.alert(
        'Error',
        'Could not launch WhatsApp. Please check device settings.'
      );
      return false;
    }
  }
}
