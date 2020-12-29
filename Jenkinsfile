pipeline {
  agent {
    docker {
      image 'jenkins/jnlp-agent-docker'
    }

  }
  stages {
    stage('error') {
      steps {
        sh 'ls '
        sh '''

docker info 
'''
        sh '''

docker build -t autotable:${BUILD_NUMBER} . 
'''
        sh '''docker tag autotable:${BUILD_NUMBER} autotable:latest 
'''
      }
    }

  }
}