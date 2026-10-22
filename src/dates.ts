export function formatLocalDate(value: string, language: string, style: "full" | "short" | "month" | "weekday" = "full") {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
 const date=new Date(value+"T12:00:00");
 if(!Number.isFinite(date.getTime())) return "";
 const zh=language.startsWith("zh");
 const options: Intl.DateTimeFormatOptions=style==="weekday"?{weekday:"short"}:style==="month"?{year:"numeric",month:"long"}:{...(style==="full"?{year:"numeric" as const}:{}),month:zh?"long":"short",day:"numeric"};
 return new Intl.DateTimeFormat(zh?"zh-CN":"en-US",options).format(date);
}
