import { StyleSheet, Text, View } from "react-native";

// Foundation placeholder — feature screens (timesheet submission, schedule
// grid, payouts, etc.) are not built yet; see PROJECT.md for scope.
export default function App() {
  return (
    <View style={styles.container}>
      <Text>Restaurant Timesheet</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
