import { THUMBNAIL_TEMPLATES } from "../../constants/templates";
import Card from "../../components/ui/Card";

export default function TemplatesCatalog() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Library
        </p>
        <h1 className="text-3xl font-bold text-text">型カタログ</h1>
        <p className="text-sm text-muted">
          21種類の構図を一覧。各型の構造・向いている用途・プロンプトフォーカスを参考に選択できます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {THUMBNAIL_TEMPLATES.map((template) => (
          <Card key={template.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                  {template.id}
                </span>
                <div>
                  <p className="text-lg font-bold text-text">{template.name}</p>
                  <p className="text-xs text-muted">{template.suitableFor}</p>
                </div>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
                Prompt Focus
              </span>
            </div>
            <p className="text-sm font-semibold text-text">構図</p>
            <p className="text-sm text-muted">{template.structure}</p>
            <p className="text-sm font-semibold text-text">フォーカス</p>
            <p className="text-sm text-muted">{template.promptFocus}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
