import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PayslipsScreen() {
  const payslips = [
    { month: 'November 2024', netSalary: '₹45,000', status: 'Generated' },
    { month: 'October 2024', netSalary: '₹45,000', status: 'Paid' },
    { month: 'September 2024', netSalary: '₹45,000', status: 'Paid' },
    { month: 'August 2024', netSalary: '₹43,200', status: 'Paid' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Payslips</Text>
        <Text style={styles.subtitle}>View and download your payslips</Text>
      </View>

      <View style={styles.content}>
        {payslips.map((payslip, index) => (
          <View key={index} style={styles.payslipCard}>
            <View style={styles.payslipHeader}>
              <MaterialCommunityIcons name="file-document" size={40} color="#3b82f6" />
              <View style={styles.payslipInfo}>
                <Text style={styles.payslipMonth}>{payslip.month}</Text>
                <Text style={styles.payslipAmount}>{payslip.netSalary}</Text>
              </View>
              <View style={[
                styles.statusBadge,
                payslip.status === 'Paid' ? styles.statusPaid : styles.statusGenerated,
              ]}>
                <Text style={styles.statusText}>{payslip.status}</Text>
              </View>
            </View>

            <View style={styles.payslipActions}>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialCommunityIcons name="eye" size={20} color="#3b82f6" />
                <Text style={styles.actionText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialCommunityIcons name="download" size={20} color="#3b82f6" />
                <Text style={styles.actionText}>Download</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    opacity: 0.9,
    marginTop: 4,
  },
  content: {
    padding: 16,
  },
  payslipCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  payslipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  payslipInfo: {
    flex: 1,
    marginLeft: 12,
  },
  payslipMonth: {
    fontSize: 16,
    fontWeight: '600',
  },
  payslipAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPaid: {
    backgroundColor: '#d1fae5',
  },
  statusGenerated: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#065f46',
  },
  payslipActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
});
