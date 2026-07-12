pipeline {
  agent any

  // ---- Tools configured in "Manage Jenkins > Tools" ----
  tools {
    nodejs 'node20'          // NodeJS installation named 'node20'
    jdk    'jdk17'           // needed by SonarScanner & Dependency-Check
  }

  environment {
    AWS_ACCOUNT_ID = '034768441662'
    AWS_REGION     = 'ap-south-1'
    ECR_REGISTRY   = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    BACKEND_REPO   = 'chatapp-backend'
    FRONTEND_REPO  = 'chatapp-frontend'
    IMAGE_TAG      = "${BUILD_NUMBER}"          // immutable, traceable tag
    SONAR_SCANNER  = tool 'sonar-scanner'       // SonarScanner CLI installation
    // GitOps repo that ArgoCD watches (can be the same repo)
    GITOPS_REPO    = 'github.com/JyothiKumar37/Full_Stack_Chatapp_CICD.git'
  }

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '15'))
    timeout(time: 45, unit: 'MINUTES')
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        script { env.GIT_SHA = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim() }
      }
    }

    stage('Install & Unit Tests') {
      parallel {
        stage('Backend') {
          steps {
            dir('backend') {
              sh 'npm ci'
              sh 'npm test --if-present'
            }
          }
        }
        stage('Frontend') {
          steps {
            dir('frontend') {
              sh 'npm ci'
              sh 'npm test --if-present'
              sh 'npm run build'          // fail fast if the SPA doesn't build
            }
          }
        }
      }
    }

    stage('SonarQube Analysis') {
      steps {
        withSonarQubeEnv('sonarqube') {    // name of the SonarQube server in Jenkins config
          sh """
            ${SONAR_SCANNER}/bin/sonar-scanner \
              -Dsonar.projectKey=chatapp \
              -Dsonar.projectName=chatapp \
              -Dsonar.sources=backend/src,frontend/src \
              -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/*.test.js
          """
        }
      }
    }

    stage('Quality Gate') {
      steps {
        timeout(time: 10, unit: 'MINUTES') {
          waitForQualityGate abortPipeline: true   // fails the build if the gate is red
        }
      }
    }

    stage('OWASP Dependency-Check') {
      steps {
        dependencyCheck odcInstallation: 'owasp-dc',
          additionalArguments: '''
            --scan ./backend --scan ./frontend
            --exclude "**/node_modules/**"
            --format HTML --format XML
            --prettyPrint
          '''
        dependencyCheckPublisher pattern: '**/dependency-check-report.xml',
          failedTotalCritical: 1, unstableTotalHigh: 5   // gate on findings
      }
    }

    stage('Trivy FS Scan') {
      steps {
        // Scan source tree for vulnerable deps & secrets before building images
        sh 'trivy fs --severity HIGH,CRITICAL --exit-code 0 --format table -o trivy-fs-report.txt .'
      }
    }

    stage('Build Images') {
      parallel {
        stage('Backend image') {
          steps {
            dir('backend') {
              sh "docker build -t ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG} -t ${ECR_REGISTRY}/${BACKEND_REPO}:latest ."
            }
          }
        }
        stage('Frontend image') {
          steps {
            dir('frontend') {
              sh "docker build -t ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG} -t ${ECR_REGISTRY}/${FRONTEND_REPO}:latest ."
            }
          }
        }
      }
    }

    stage('Trivy Image Scan') {
      steps {
        // Gate hard on CRITICAL; report HIGH for visibility without blocking
        // (base-image/tooling HIGHs often have no app-level fix).
        sh "trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
        sh "trivy image --severity HIGH     --exit-code 0 ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}"
        sh "trivy image --severity CRITICAL --exit-code 1 --ignore-unfixed ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
        sh "trivy image --severity HIGH     --exit-code 0 ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}"
      
      }
    }

    stage('Push to ECR') {
      steps {
        sh """
          aws ecr get-login-password --region ${AWS_REGION} \
            | docker login --username AWS --password-stdin ${ECR_REGISTRY}
          docker push ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}
          docker push ${ECR_REGISTRY}/${BACKEND_REPO}:latest
          docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}
          docker push ${ECR_REGISTRY}/${FRONTEND_REPO}:latest
        """
      }
    }

    stage('Update GitOps Manifests') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'github-token',
                          usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
          sh """
            git config user.email "jenkins@ci.local"
            git config user.name  "jenkins"

            # bump the image tags in the k8s manifests
            sed -i -E "s#image: .*${BACKEND_REPO}:.*#image: ${ECR_REGISTRY}/${BACKEND_REPO}:${IMAGE_TAG}#"   k8s/backend-deployment.yaml
            sed -i -E "s#image: .*${FRONTEND_REPO}:.*#image: ${ECR_REGISTRY}/${FRONTEND_REPO}:${IMAGE_TAG}#" k8s/frontend-deployment.yaml

            git add k8s/backend-deployment.yaml k8s/frontend-deployment.yaml
            git commit -m "ci: deploy ${BACKEND_REPO}/${FRONTEND_REPO}:${IMAGE_TAG} [skip ci]" || echo "no changes"
            git push https://${GIT_USER}:${GIT_TOKEN}@${GITOPS_REPO} HEAD:master
          """
        }
        // ArgoCD (auto-sync) picks up the commit and rolls out the new images.
      }
    }
  }

  post {
    always {
      archiveArtifacts artifacts: '**/dependency-check-report.*, trivy-fs-report.txt', allowEmptyArchive: true
      publishHTML(target: [reportDir: '.', reportFiles: 'dependency-check-report.html',
                           reportName: 'OWASP Dependency-Check', keepAll: true, alwaysLinkToLastBuild: true])
      sh 'docker image prune -f || true'
    }
    success { echo "✅ Deployed ${IMAGE_TAG} (${GIT_SHA}) — ArgoCD will sync it." }
    failure { echo "❌ Pipeline failed at ${STAGE_NAME}. Check reports." }
  }
}

