import { useTranslation } from "react-i18next";

import { messagingApi } from "../api/api";
import SendMessagePanel from "../components/SendMessagePanel";

export default function ParentUpdates() {
  const { t } = useTranslation();
  return <SendMessagePanel category="parent_update" sendFn={messagingApi.sendParentUpdates} title={t("nav.parent_updates")} />;
}
