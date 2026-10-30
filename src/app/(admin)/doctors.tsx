import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useDoctorStore } from '../../store/doctorStore';

export default function AdminDoctorsScreen() {
  const doctors = useDoctorStore((state) => state.doctors);
  const updateStatus = useDoctorStore((state) => state.updateApprovalStatus);

  const pendingDoctors = doctors.filter(
    (doctor) => doctor.approvalStatus === 'pending'
  );

  const reviewDoctor = (id: string, status: 'approved' | 'rejected') => {
    Alert.alert(
      status === 'approved' ? 'Approve doctor?' : 'Reject doctor?',
      'This changes the doctor profile status in local demo storage.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => updateStatus(id, status),
        },
      ]
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Doctor Approval</Text>
      <Text style={styles.subtitle}>
        {pendingDoctors.length} doctor(s) awaiting review
      </Text>

      <FlatList
        data={pendingDoctors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No pending doctor registrations.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.detail}>{item.email}</Text>
            <Text style={styles.detail}>Specialty: {item.specialty}</Text>
            <Text style={styles.detail}>
              Qualification: {item.qualification}
            </Text>
            <Text style={styles.detail}>
              Experience: {item.experience} years
            </Text>
            <Text style={styles.detail}>Fee: ৳{item.fee}</Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.approve]}
                onPress={() => reviewDoctor(item.id, 'approved')}
              >
                <Text style={styles.buttonText}>Approve</Text>
              </Pressable>
              <Pressable
                style={[styles.button, styles.reject]}
                onPress={() => reviewDoctor(item.id, 'rejected')}
              >
                <Text style={styles.buttonText}>Reject</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC', padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A' },
  subtitle: { color: '#64748B', marginTop: 6 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  name: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  detail: { color: '#475569', marginTop: 7 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  button: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  approve: { backgroundColor: '#0F766E' },
  reject: { backgroundColor: '#DC2626' },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  empty: { color: '#64748B', paddingVertical: 30, textAlign: 'center' },
});
