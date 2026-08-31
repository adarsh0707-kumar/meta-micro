import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import DashboardLayout from "./layouts/DashboardLayout";
import Attendance from "./pages/Attendance";
import Automations from "./pages/Automations";
import BatchDetails from "./pages/BatchDetails";
import Batches from "./pages/Batches";
import FeeReminders from "./pages/FeeReminders";
import Fees from "./pages/Fees";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ParentUpdates from "./pages/ParentUpdates";
import Setup from "./pages/Setup";
import SignUp from "./pages/SignUp";
import StudentDetails from "./pages/StudentDetails";
import Students from "./pages/Students";
import Templates from "./pages/Templates";
import TestScores from "./pages/TestScores";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="students" replace />} />
        <Route path="students" element={<Students />} />
        <Route path="students/:studentId" element={<StudentDetails />} />
        <Route path="batches" element={<Batches />} />
        <Route path="batches/:batchId" element={<BatchDetails />} />
        <Route path="fees" element={<Fees />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="test-scores" element={<TestScores />} />
        <Route path="templates" element={<Templates />} />
        <Route path="fee-reminders" element={<FeeReminders />} />
        <Route path="parent-updates" element={<ParentUpdates />} />
        <Route path="automations" element={<Automations />} />
        <Route path="setup" element={<Setup />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
