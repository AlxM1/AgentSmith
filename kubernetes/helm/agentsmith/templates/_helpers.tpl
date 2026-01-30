{{/*
Expand the name of the chart.
*/}}
{{- define "agentsmith.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "agentsmith.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "agentsmith.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "agentsmith.labels" -}}
helm.sh/chart: {{ include "agentsmith.chart" . }}
{{ include "agentsmith.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "agentsmith.selectorLabels" -}}
app.kubernetes.io/name: {{ include "agentsmith.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "agentsmith.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "agentsmith.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database host
*/}}
{{- define "agentsmith.databaseHost" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.host }}
{{- else }}
{{- printf "%s-postgresql" (include "agentsmith.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Database port
*/}}
{{- define "agentsmith.databasePort" -}}
{{- if .Values.externalDatabase.enabled }}
{{- .Values.externalDatabase.port }}
{{- else }}
{{- 5432 }}
{{- end }}
{{- end }}

{{/*
Redis host
*/}}
{{- define "agentsmith.redisHost" -}}
{{- if .Values.externalRedis.enabled }}
{{- .Values.externalRedis.host }}
{{- else }}
{{- printf "%s-redis-master" (include "agentsmith.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Redis port
*/}}
{{- define "agentsmith.redisPort" -}}
{{- if .Values.externalRedis.enabled }}
{{- .Values.externalRedis.port }}
{{- else }}
{{- 6379 }}
{{- end }}
{{- end }}
