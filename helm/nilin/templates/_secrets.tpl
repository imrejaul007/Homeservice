{{- /*
NILIN Secrets Template
*/ -}}
{{- define "nilin.secrets" -}}
{{- $fullName := include "nilin.fullname" . -}}
{{- $namespace := .Release.Namespace -}}
apiVersion: v1
kind: Secret
metadata:
  name: {{ $fullName }}-secrets
  namespace: {{ $namespace }}
  labels:
    {{- include "nilin.labels" . | nindent 4 }}
    app.kubernetes.io/component: secrets
type: Opaque
stringData:
  {{- if .Values.secrets.mongodbUri }}
  MONGODB_URI: {{ .Values.secrets.mongodbUri | b64enc | quote }}
  {{- end }}
  {{- if .Values.secrets.redisUrl }}
  REDIS_URL: {{ .Values.secrets.redisUrl | b64enc | quote }}
  {{- end }}
  {{- if .Values.secrets.jwtSecret }}
  JWT_SECRET: {{ .Values.secrets.jwtSecret | b64enc | quote }}
  {{- end }}
  {{- if .Values.secrets.stripeSecret }}
  STRIPE_SECRET_KEY: {{ .Values.secrets.stripeSecret | b64enc | quote }}
  {{- end }}
  {{- if .Values.secrets.resendApiKey }}
  RESEND_API_KEY: {{ .Values.secrets.resendApiKey | b64enc | quote }}
  {{- end }}
{{- end }}

{{- /*
NILIN ConfigMap Template
*/ -}}
{{- define "nilin.configmap" -}}
{{- $fullName := include "nilin.fullname" . -}}
{{- $namespace := .Release.Namespace -}}
{{- $env := .Values.environment | default "production" -}}
apiVersion: v1
kind: ConfigMap
metadata:
  name: {{ $fullName }}-config
  namespace: {{ $namespace }}
  labels:
    {{- include "nilin.labels" . | nindent 4 }}
    app.kubernetes.io/component: config
data:
  NODE_ENV: {{ $env | quote }}
  PORT: {{ .Values.api.service.port | quote | default "10000" | quote }}
  LOG_LEVEL: {{ .Values.api.logLevel | default "info" | quote }}
  LOG_FORMAT: {{ .Values.api.logFormat | default "json" | quote }}
{{- end }}
