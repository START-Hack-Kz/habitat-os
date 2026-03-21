# AWS Deployment

Use `us-west-2` for Lambda deployment in the workshop account.

Keep using the existing KB MCP URL in `us-east-2` if you want KB grounding.

## Services

1. Backend
   - Node/Fastify
   - deploy as Lambda from `backend/src/lambda.ts`
2. AI service
   - Python/FastAPI
   - deploy as a separate Lambda from `ai_service/lambda_handler.py`
3. Ops MCP service
   - Python/FastMCP
   - deploy as a separate Lambda from `ai_service/ops_mcp_lambda_handler.py`
4. Frontend
   - Vite static build
   - deploy with Amplify manual deploy or S3 static hosting if allowed

## DynamoDB

Create the mission-state table first:

```bash
export AWS_REGION=us-west-2

aws dynamodb create-table \
  --region $AWS_REGION \
  --table-name habitat-os-mission-state \
  --attribute-definitions AttributeName=missionId,AttributeType=S \
  --key-schema AttributeName=missionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb wait table-exists \
  --region $AWS_REGION \
  --table-name habitat-os-mission-state
```

Grant the backend Lambda role access:

```bash
aws iam put-role-policy \
  --role-name habitat-os-backend-lambda-role \
  --policy-name habitat-os-backend-dynamodb \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "dynamodb:GetItem",
          "dynamodb:PutItem"
        ],
        "Resource": "arn:aws:dynamodb:us-west-2:436161771361:table/habitat-os-mission-state"
      }
    ]
  }'
```

Then set the backend Lambda environment:

```bash
aws lambda update-function-configuration \
  --region $AWS_REGION \
  --function-name habitat-os-backend \
  --environment "Variables={CORS_ORIGINS=*,MISSION_STATE_TABLE=habitat-os-mission-state,MISSION_STATE_KEY=mars-greenhouse-alpha,AWS_REGION=$AWS_REGION}"
```

## Backend build

```bash
npm install
npm run backend:build:lambda
cd .aws-build/backend
zip -r function.zip index.js
cd ../..
```

## AI build

```bash
python3 -m venv .aws-build/ai-build-venv
source .aws-build/ai-build-venv/bin/activate
pip install --upgrade pip
pip install -r ai_service/requirements.txt --target .aws-build/ai-service
cp ai_service/app.py .aws-build/ai-service/
cp ai_service/agent.py .aws-build/ai-service/
cp ai_service/models.py .aws-build/ai-service/
cp ai_service/tools.py .aws-build/ai-service/
cp ai_service/lambda_handler.py .aws-build/ai-service/
cp ai_service/ops_mcp_server.py .aws-build/ai-service/
cp ai_service/ops_mcp_lambda_handler.py .aws-build/ai-service/
cd .aws-build/ai-service
zip -r function.zip .
cd ../..
```

## Ops MCP build

You can reuse the same Python artifact for the AI and ops MCP Lambdas because
both need the same Python dependencies.

## IAM trust policy

Use `deploy/lambda-trust-policy.json` when creating Lambda execution roles.
