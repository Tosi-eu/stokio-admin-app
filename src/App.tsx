import { AppToaster } from "@/components/toast";
import { AppShell } from "@/components/layout/AppShell";
import { useAdminApp } from "@/hooks/useAdminApp";
import { LoginScreen } from "@/screens/LoginScreen";
import { InfraHealthScreen } from "@/screens/InfraHealthScreen";
import { SystemSettings } from "@/screens/SystemSettings";
import { TenantsWorkspace } from "@/screens/TenantsWorkspace";
import { ErrorEventsScreen } from "@/screens/ErrorEventsScreen";

export function App() {
  const admin = useAdminApp();

  if (!admin.authenticated) {
    return (
      <>
        <AppToaster />
        <LoginScreen
          apiKey={admin.apiKey}
          onApiKeyChange={admin.setApiKey}
          loading={admin.loading}
          authError={admin.authError}
          canTryLogin={admin.canTryLogin}
          onConnect={admin.connect}
        />
      </>
    );
  }

  return (
    <>
      <AppToaster />
      <AppShell
        adminTab={admin.adminTab}
        onTabChange={admin.setAdminTab}
        theme={admin.theme}
        onThemeChange={admin.setTheme}
        loading={admin.loading}
        onRefresh={admin.connect}
        onDisconnect={admin.disconnect}
      >
        {admin.adminTab === "system" ? (
          <SystemSettings
            request={admin.configRequest}
            disabled={admin.loading}
          />
        ) : admin.adminTab === "infra" ? (
          <InfraHealthScreen
            request={admin.configRequest}
            disabled={admin.loading}
          />
        ) : admin.adminTab === "errors" ? (
          <ErrorEventsScreen
            request={admin.configRequest}
            disabled={admin.loading}
          />
        ) : (
          <TenantsWorkspace
            loading={admin.loading}
            tenants={admin.tenants}
            selectedTenant={admin.selectedTenant}
            createSlug={admin.createSlug}
            setCreateSlug={admin.setCreateSlug}
            createName={admin.createName}
            setCreateName={admin.setCreateName}
            createContract={admin.createContract}
            setCreateContract={admin.setCreateContract}
            selectedSlug={admin.selectedSlug}
            setSelectedSlug={admin.setSelectedSlug}
            newContractCode={admin.newContractCode}
            setNewContractCode={admin.setNewContractCode}
            boundLogin={admin.boundLogin}
            setBoundLogin={admin.setBoundLogin}
            xlsxFile={admin.xlsxFile}
            setXlsxFile={admin.setXlsxFile}
            dumpFile={admin.dumpFile}
            setDumpFile={admin.setDumpFile}
            birthDateFallback={admin.birthDateFallback}
            setBirthDateFallback={admin.setBirthDateFallback}
            createTenant={admin.createTenant}
            alterContract={admin.alterContract}
            uploadXlsx={admin.uploadXlsx}
            uploadPgDump={admin.uploadPgDump}
          />
        )}
      </AppShell>
    </>
  );
}
