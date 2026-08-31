import { useTranslation } from "react-i18next";

import { messagingApi } from "../api/api";
import SendMessagePanel from "../components/SendMessagePanel";

export default function FeeReminders() {
  const { t } = useTranslation();
  return <SendMessagePanel category="fee_reminder" sendFn={messagingApi.sendFeeReminders} title={t("nav.fee_reminders")} />;
}
