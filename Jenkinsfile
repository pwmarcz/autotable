pipeline {
  agent any
  stages {
    stage('') {
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