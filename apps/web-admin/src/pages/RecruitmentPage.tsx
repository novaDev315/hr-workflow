import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecruitmentPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <p className="app-kicker">Recruitment</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-foreground">
            Live hiring data will appear here.
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">No sample pipeline.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <p className="app-kicker">Status</p>
          <CardTitle>Waiting for live records</CardTitle>
        </CardHeader>
      </Card>
    </div>
  );
}
